# v0.1.2

Review follow-up for the initial Biamp Qt X submission.

## Fixes

- Restored required Companion TypeScript template scaffold files and package scripts
- Matched manifest `name` to the module id
- Updated feedbacks to use feedback context variable parsing
- Added write-action error handling with connection errors separated from operator/request errors
- Added safer defaults for presets and zone fields using `output1`
- Clamped masking levels to the Qt X API range
- Ignored stale full-refresh responses after config changes
- Cleared zone state on instance teardown
- Documented zone resolution order and level scaling

## Validation

- Ran `yarn format`
- Ran `yarn lint`
- Ran `yarn build`
- Ran `yarn package`

# v0.1.1

Initial Companion module release for Biamp Qt X sound masking controllers.

## Highlights

- Discover Qt X zones from the controller configuration API
- Set, adjust, enable, disable, and toggle masking levels by zone
- Mute and unmute zones
- Expose zone status variables and feedbacks
- Include starter presets for common masking levels
- Support custom zone JSON updates for advanced control

## Compatibility

- Uses the Biamp Qt X REST API
- Module repository and issue links point to the Bitfocus module repository

## Validation

- Ran `npm run lint`
- Ran `npm run build`
- Ran `npx --no-install companion-module-check`
