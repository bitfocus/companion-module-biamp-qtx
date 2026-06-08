# Biamp Qt X

Controls Biamp Qt X sound masking systems using the REST API.

## Setup

Enter the Qt X controller address and choose HTTP or HTTPS to match the Web UI/API endpoint.

Use **Refresh zones** after connecting. Zone IDs are UUID/GUID values available from the Web UI JSON export or from `GET /api/v1/Config`.

## Level Scaling

Qt X API levels use the device's raw API value. Biamp documents that the Qt X UI/API level examples map UI dB to API values by subtracting 10 and multiplying by 10.

For example, UI `10 dB` is API `0`, and UI `0 dB` is API `-100`.
