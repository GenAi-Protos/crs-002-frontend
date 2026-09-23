// Exercise the real UI against an isolated fake-provider backend, not route mocks.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.WORKSPACE_BASE_URL ?? "http://127.0.0.1:3001";
const api = process.env.WORKSPACE_API_URL ?? "http://127.0.0.1:8001";
for (const url of [base, api]) assert(["127.0.0.1", "localhost"].includes(new URL(url).hostname), "Run acceptance only against an isolated localhost test instance.");
const stamp = Date.now();
const title = `Browser acceptance ${stamp}`;
const output = process.env.WORKSPACE_TEST_ARTIFACTS ?? path.join(tmpdir(), `crs-workspace-browser-${stamp}`);
const users = JSON.parse(await readFile(new URL("../fixtures/users.json", import.meta.url), "utf8"));
const analyst = users.find((user) => user.role === "analyst").id;
const lead = users.find((user) => user.role === "lead-analyst").id;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: process.env.WORKSPACE_HEADED !== "true" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(30_000);
page.setDefaultNavigationTimeout(60_000);
const errors = [];
const results = [];
page.on("pageerror", (error) => errors.push(error.message));
const visible = (locator, timeout = 30_000) => locator.waitFor({ state: "visible", timeout });
const responseFor = (suffix, method = "POST") => page.waitForResponse((response) => response.url().startsWith(api) && response.url().split("?")[0].endsWith(suffix) && response.request().method() === method, { timeout: 120_000 });
const role = async (value) => { await page.getByLabel("Role", { exact: true }).selectOption(value); };
async function record(name) { results.push({ name, passed: true }); console.log(`PASS ${name}`); }
async function apiGet(url, userId = analyst) { return page.request.get(`${api}${url}`, { headers: { "X-Nestor-User": userId } }); }
// /intelligence/ask answers as server-sent events; the final `turn` event is the conversation turn.
async function askTurn(response) {
  const events = (await response.text()).replace(/\r\n/g, "\n").split("\n\n").map((block) => ({
    event: block.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim(),
    data: block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n"),
  }));
  const final = events.find((e) => e.event === "turn");
  assert(final, `no turn event in the answer stream: ${JSON.stringify(events.map((e) => e.event))}`);
  return JSON.parse(final.data);
}

try {
  await page.goto(base, { waitUntil: "networkidle" });
  const signatures = new Set();
  for (const value of ["analyst", "lead-analyst", "incident-responder", "leadership", "executive", "sales"]) {
    const ready = responseFor(`/dashboard/views/${value}`, "GET");
    await role(value);
    if (value === "analyst") await page.getByRole("button", { name: "Refresh", exact: true }).click();
    const response = await ready;
    assert.equal(response.status(), 200, `dashboard ${value}`);
    const payload = await response.json();
    await visible(page.getByRole("region", { name: "Role metrics" }));
    signatures.add(payload.kpis.map((item) => item.key).join("|"));
    if (value === "sales" || value === "executive") {
      assert.equal(await page.getByRole("link", { name: "Investigation", exact: true }).count(), 0);
    }
  }
  assert.equal(signatures.size, 6, "Every role must have distinct metrics.");
  await page.screenshot({ path: path.join(output, "sales-dashboard.png"), fullPage: true, animations: "disabled" });
  await record("Six live role dashboards and restricted navigation");

  await role("analyst");
  await page.goto(`${base}/collection?tab=sources`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add Source", exact: true }).click();
  const sourceDialog = page.getByRole("dialog", { name: "Add Source", exact: true });
  await visible(sourceDialog);
  assert.equal(await sourceDialog.getByLabel("Source Category", { exact: false }).inputValue(), "Analyst Provided");
  assert.equal(await sourceDialog.getByLabel("Confidence", { exact: true }).inputValue(), "Low");
  assert.deepEqual(await sourceDialog.getByLabel("Source Category", { exact: true }).locator("option").allTextContents(), ["Analyst Provided", "OSINT Feeds", "IOC Feeds", "Vulnerability Monitoring", "Ransomware Monitoring", "Geopolitical Intelligence", "Telegram and Messaging"]);
  assert.equal(await sourceDialog.getByRole("button", { name: "Submit to Repository" }).isDisabled(), true);
  await sourceDialog.getByLabel("Intelligence Title", { exact: false }).fill(title);
  await sourceDialog.getByLabel("Description", { exact: true }).fill(`Analyst supplied evidence for ${title}. The evidence concerns a phishing campaign and recommended indicator review.`);
  const sourceUpload = responseFor("/evidence");
  await sourceDialog.getByLabel("Evidence files", { exact: true }).setInputFiles({ name: "source-evidence.csv", mimeType: "text/csv", buffer: Buffer.from(`subject,observation\n${title},Phishing campaign observed in email messages\n`) });
  assert.equal((await sourceUpload).status(), 202);
  await visible(sourceDialog.getByText("ready", { exact: true }));
  await page.screenshot({ path: path.join(output, "add-source-laptop.png"), fullPage: true, animations: "disabled" });
  const submitted = responseFor("/collection/submissions");
  await sourceDialog.getByRole("button", { name: "Submit to Repository" }).click();
  const submittedResponse = await submitted;
  assert.equal(submittedResponse.status(), 202);
  const submission = await submittedResponse.json();
  await visible(page.getByRole("dialog", { name: title, exact: true }));
  await page.getByRole("dialog", { name: title, exact: true }).getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill(title);
  await visible(page.getByRole("button", { name: title, exact: true }));
  assert((await (await apiGet(`/collection/submissions/${submission.id}`)).json()).attachmentIds.length === 1);
  await record("Add Source validation, file processing, repository submission and searchable listing");

  await page.goto(`${base}/intelligence`, { waitUntil: "networkidle" });
  await page.getByLabel("Client", { exact: true }).selectOption("CLT-027");
  const evidenceUploaded = responseFor("/evidence");
  await page.getByLabel("Evidence files", { exact: true }).setInputFiles({ name: "private-evidence.csv", mimeType: "text/csv", buffer: Buffer.from(`subject,observation\n${title},A suspicious phishing campaign uses fleet-update.example to contact victims\n`) });
  const evidenceResponse = await evidenceUploaded;
  assert.equal(evidenceResponse.status(), 202);
  const file = (await evidenceResponse.json()).items[0];
  await visible(page.getByText("ready", { exact: true }));
  const question = `Phishing campaign fleet-update.example: summarize supporting evidence for ${title}`;
  await page.getByRole("textbox", { name: "Question", exact: true }).fill(question);
  const answerReady = responseFor("/intelligence/ask");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const answerResponse = await answerReady;
  assert.equal(answerResponse.status(), 200, await answerResponse.text());
  const conversation = await askTurn(answerResponse);
  assert(conversation.turn.attachmentIds.includes(file.id));
  assert.equal((await apiGet(`/evidence/${file.id}`, lead)).status(), 404, "Query uploads must remain private before promotion.");
  await visible(page.getByRole("button", { name: "Add to investigation", exact: true }));
  await page.getByRole("textbox", { name: "Question", exact: true }).fill("Phishing fleet-update.example indicators: summarize the available supporting evidence");
  const followupReady = responseFor("/intelligence/ask");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const followupResponse = await followupReady;
  assert.equal(followupResponse.status(), 200, await followupResponse.text());
  const followup = await askTurn(followupResponse);
  assert.equal(followup.investigationId, conversation.investigationId);
  assert(followup.turn.attachmentIds.includes(file.id), "Follow-ups must retain selected private evidence.");
  const followupRun = await (await apiGet(`/intelligence/runs/${followup.turn.answer.runId}`)).json();
  assert.deepEqual(followupRun.clientIds, ["CLT-027"], "Client-scoped follow-up must retain its effective audience.");
  await visible(page.getByText("Attached: private-evidence.csv", { exact: true }).nth(1));
  await record("Private query upload, persisted answer and client-scoped attachment follow-up");

  await page.getByRole("button", { name: "Add to investigation", exact: true }).last().click();
  await page.getByRole("dialog", { name: "Add to investigation" }).getByRole("button", { name: "Create new", exact: true }).click();
  const caseDialog = page.getByRole("dialog", { name: "New investigation", exact: true });
  await caseDialog.locator('select option[value="CLT-027"]').waitFor({ state: "attached" });
  assert.equal(await caseDialog.getByLabel("Client scope", { exact: true }).inputValue(), "CLT-027");
  await caseDialog.getByLabel("Title", { exact: true }).fill(title);
  await caseDialog.getByLabel("Objective", { exact: true }).fill(`Phishing campaign fleet-update.example: identify supported activity, indicators and coverage limitations for ${title}.`);
  await caseDialog.getByLabel("Entity 1 value", { exact: true }).fill("fleet-update.example");
  await caseDialog.getByLabel("Choose available sources automatically", { exact: true }).uncheck();
  await visible(caseDialog.getByText("Held intelligence repository", { exact: false }));
  await caseDialog.getByRole("button", { name: "Create investigation", exact: true }).click();
  await page.waitForURL(/\/investigations\/case-/);
  const caseId = new URL(page.url()).pathname.split("/").at(-1);
  const savedCase = await (await apiGet(`/investigations/${caseId}`)).json();
  assert(savedCase.case.evidenceIds.includes(file.id));
  assert.equal((await apiGet(`/evidence/${file.id}`, lead)).status(), 200, "Explicit case promotion shares selected evidence.");
  const runStarted = responseFor(`/investigations/${caseId}/run`);
  await page.getByRole("button", { name: "Run investigation", exact: true }).click();
  assert.equal((await runStarted).status(), 202);
  await visible(page.getByRole("button", { name: "Run investigation", exact: true }), 120_000);
  await page.getByRole("tab", { name: "Agents and evidence", exact: true }).click();
  await visible(page.getByRole("heading", { name: "Agent activity", exact: true }));
  const caseAfterRun = await (await apiGet(`/investigations/${caseId}`)).json();
  assert(caseAfterRun.contributions.some((step) => step.evidence.length > 0));
  assert(caseAfterRun.runs.every((run) => run.status !== "running"));
  await page.screenshot({ path: path.join(output, "case-agents.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("tab", { name: "Findings and pivots", exact: true }).click();
  await visible(page.getByRole("heading", { name: "Evidence relationships", exact: true }));
  await page.screenshot({ path: path.join(output, "case-findings.png"), fullPage: true, animations: "disabled" });
  await record("Explicit query-to-case promotion, source selection and real specialist execution");

  await page.getByRole("tab", { name: "Report", exact: true }).click();
  await page.getByRole("button", { name: "Generate draft", exact: true }).click();
  await page.getByRole("link", { name: title, exact: true }).click();
  await visible(page.getByRole("textbox", { name: "Report title", exact: true }));
  const editedTitle = `${title} reviewed`;
  await page.getByRole("textbox", { name: "Report title", exact: true }).fill(editedTitle);
  const saved = responseFor(new URL(page.url()).pathname, "PATCH");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  assert.equal((await saved).status(), 200);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByRole("textbox", { name: "Report title", exact: true }).inputValue(), editedTitle);
  await page.screenshot({ path: path.join(output, "saved-report.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Submit for review", exact: true }).click();
  await visible(page.getByText("In review", { exact: true }));
  await role("lead-analyst");
  await visible(page.getByRole("button", { name: "Send back", exact: true }));
  await page.getByRole("button", { name: "Send back", exact: true }).click();
  await page.getByRole("dialog", { name: "Send back", exact: true }).getByRole("button", { name: "Factual correction", exact: true }).click();
  await visible(page.getByRole("button", { name: "Submit for review", exact: true }));
  await page.getByRole("button", { name: "Submit for review", exact: true }).click();
  await visible(page.getByRole("button", { name: "Approve & publish", exact: true }));
  await page.getByRole("button", { name: "Approve & publish", exact: true }).click();
  await visible(page.getByText("Published", { exact: true }));
  await page.getByRole("button", { name: "Issue an update", exact: true }).click();
  await page.getByRole("dialog", { name: "Issue an update", exact: true }).getByLabel("Change note", { exact: true }).fill("Add the analyst review follow-up details.");
  await page.getByRole("button", { name: "Create update draft", exact: true }).click();
  await visible(page.getByRole("textbox", { name: "Report title", exact: true }));
  await record("Persistent report Save, reload, submit, lead send-back, publish and update draft");

  await page.goto(`${base}/intelligence?lookup=8.8.8.8`, { waitUntil: "networkidle" });
  const checked = responseFor("/intelligence/lookup");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  assert.equal((await checked).status(), 200);
  await visible(page.getByRole("heading", { name: "Repository evidence", exact: true }));
  await visible(page.getByRole("button", { name: "Add to investigation", exact: true }));
  await record("IOC repository/provider lookup with explicit case handoff");

  await page.goto(`${base}/reports`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "New report", exact: true }).click();
  await page.getByRole("dialog", { name: "New report", exact: true }).getByRole("button", { name: /^RFI\s/ }).click();
  await page.waitForURL(/\/investigations\/new$/);
  await visible(page.getByRole("dialog", { name: "New investigation", exact: true }));
  await page.getByRole("dialog", { name: "New investigation", exact: true }).getByRole("button", { name: "Cancel", exact: true }).click();
  await page.waitForURL(/\/investigations$/);
  await record("New RFI entry point opens the dedicated Investigation workspace");

  await page.goto(`${base}/collection?tab=sources`, { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Add Source", exact: true }).click();
  const narrow = page.getByRole("dialog", { name: "Add Source", exact: true });
  await visible(narrow);
  const bounds = await narrow.boundingBox();
  assert(bounds.width <= 391 && bounds.height <= 844, "Modal must fit a narrow viewport.");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "The shell must fit the narrow viewport without horizontal overflow.");
  await page.keyboard.press("Tab");
  assert(await narrow.evaluate((element) => element.contains(document.activeElement)), "Keyboard focus must remain in the dialog.");
  await page.screenshot({ path: path.join(output, "add-source-narrow.png"), fullPage: true, animations: "disabled" });
  await page.keyboard.press("Escape");
  await narrow.waitFor({ state: "detached" });
  await record("Narrow Add Source layout, modal focus and Escape dismissal");
  assert.deepEqual(errors, [], "Unexpected browser runtime errors");
  await writeFile(path.join(output, "results.json"), JSON.stringify({ passed: true, results, errors }, null, 2));
  console.log(`Artifacts: ${output}`);
} catch (error) {
  await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true, animations: "disabled" }).catch(() => undefined);
  await writeFile(path.join(output, "failure.txt"), `${error.stack}\n\n${await page.locator("body").innerText().catch(() => "")}\n${JSON.stringify(errors)}`);
  console.error(`Artifacts: ${output}`);
  throw error;
} finally {
  await browser.close();
}
