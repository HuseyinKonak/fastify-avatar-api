# Security Policy

## Supported versions

Security fixes are applied to the latest commit on the default branch. This
project does not currently maintain multiple release branches.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature for this repository.
If it is unavailable, contact the repository owner privately through the contact
method listed on their GitHub profile.

Include reproduction steps, affected endpoints or configuration, the expected
impact, and any suggested remediation. Do not include real credentials or data.
Please allow a reasonable period for investigation before public disclosure.

## Deployment notes

- Keep `TRUST_PROXY=false` unless traffic can arrive only through a trusted proxy.
- Configure an exact `CORS_ORIGINS` allowlist when browser access is needed.
- Production metrics require both `ENABLE_METRICS=true` and a strong
  `METRICS_TOKEN`.
- Swagger UI is disabled in production.
- Apply network-level controls, resource limits, TLS, and dependency updates in
  the deployment environment.
