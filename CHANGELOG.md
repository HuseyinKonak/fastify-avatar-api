# Changelog

All notable changes to this project will be documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- Prepared the repository for public release with neutral project naming and
  evidence-based documentation.
- Replaced permissive production CORS behavior with an explicit origin allowlist.
- Disabled Swagger UI in production.
- Made production metrics opt-in and bearer-token protected.
- Changed the default proxy trust setting to disabled.
- Added CI, contribution, and security documentation.

## [1.1.0] - 2026-06-24

### Added

- Avatar rendering in PNG, WebP, JPEG, and SVG formats.
- Worker-thread rendering, two-level caching, metrics, health checks, and tests.
