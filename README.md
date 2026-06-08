# companion-module-biamp-qtx

Bitfocus Companion module for Biamp Qt X sound masking controllers.

This first version focuses on zone masking control over the Qt X REST API.

## Features

- Discover zones from `GET /api/v1/Config`
- Set, adjust, enable, disable, and toggle zone masking levels
- Mute and unmute zones
- Send custom zone JSON with `PUT /api/v1/Config/Zone/{id}`
- Expose zone status variables and feedbacks
- Include starter presets for common masking levels

## Development

```bash
yarn install --immutable
yarn lint
yarn build
yarn package
```
