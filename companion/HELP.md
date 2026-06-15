# Biamp Qt X

Controls Biamp Qt X sound masking systems using the REST API.

## Setup

Enter the Qt X controller address and choose HTTP or HTTPS to match the Web UI/API endpoint.

Use **Refresh zones** after connecting. Zone IDs are UUID/GUID values available from the Web UI JSON export or from `GET /api/v1/Config`.

Actions and feedbacks resolve the zone field in this order: exact zone ID, zone name, then output name. A bare number such as `1` resolves as `output1`. The included presets use `output1` as a starter value; change it if your first controlled zone is on a different output.

## Level Scaling

Qt X API levels use the device's raw API value. Biamp documents that the Qt X UI/API level examples map UI dB to API values by subtracting 10 and multiplying by 10.

For example, UI `10 dB` is API `0`, and UI `0 dB` is API `-100`.

Masking levels are clamped to the Qt X API range of `-1000` to `200`.
