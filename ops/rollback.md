# Rollback

Shift Azure Container Apps traffic to the previous known-good revision (AGT-CICD §10.3).
The previous revision name is captured in release evidence so rollback is a single command.

## Procedure
```bash
az containerapp ingress traffic set -n <app> -g <rg> \
  --revision-weight <previous-revision>=100
```
TODO(vendor): record current known-good revision and confirm validation steps post-rollback.
