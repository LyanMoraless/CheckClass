---
name: iot-computer-vision
description: Generic technical knowledge for sensors, cameras, embedded devices, device-backend communication, edge computing, image processing, detection, and tracking. Used by both the IoT Agent and the Computer Vision Agent, which split responsibility along device/transport (IoT) versus frame processing/inference (Computer Vision).
---

# IoT & Computer Vision

## Purpose

Generic technical knowledge spanning physical-device integration and
image/video processing. This skill is shared by two agents with a clear
division: the **IoT Agent** owns the device, its communication with the
backend, and edge processing decisions; the **Computer Vision Agent**
owns what happens to a frame once it exists — detection, tracking,
recognition.

## Sensors and signal handling

- Raw sensor readings are noisy — expect and handle jitter/outliers
  rather than treating every raw reading as ground truth.
- Calibration matters; a sensor's raw output often needs conversion to
  meaningful units, and that conversion is device/model-specific.

## Device-to-backend communication

- Choose payload format and frequency based on actual bandwidth/power
  constraints of the device (see `hardware-evaluation`), not
  convenience.
- Common protocols and when they tend to fit:
  - **MQTT** — lightweight, pub/sub, good for many low-power devices
    reporting periodically.
  - **HTTP/REST** — simple, good when devices are less constrained and
    request/response fits the interaction model.
  - **WebSocket** — good for low-latency, bidirectional communication.
  - **Modbus/industrial protocols** — relevant when integrating with
    industrial equipment that already speaks these protocols.

## Edge computing (what runs where)

- Process locally what reduces bandwidth need or requires low latency
  (e.g., basic filtering, simple threshold detection); send to backend
  what needs heavier processing, storage, or cross-device correlation.
- This decision must respect the actual hardware's processing/power
  budget — don't assume edge processing capacity that the approved
  hardware doesn't have.

## Hardware reliability

- Assume the device *will* lose connection, restart, or degrade over
  time — design explicit behavior for reconnection, buffering data
  during an outage, and recovering cleanly after a restart.
- Distinguish a transient failure (retry) from a persistent one (alert/
  flag) rather than retrying indefinitely.

## Image capture and processing (Computer Vision)

- Frame capture/transport is the IoT Agent's responsibility — the
  Computer Vision Agent consumes frames already delivered, it doesn't
  manage the camera device directly.
- Preprocessing (resizing, normalization, noise reduction) matters for
  detection accuracy — don't skip it assuming raw frames are "good
  enough."

## Detection, tracking, recognition

- **Detection** accuracy depends heavily on real conditions: lighting,
  camera angle, distance, occlusion. State these constraints explicitly
  rather than implying a detection approach works universally.
- **Tracking** across frames needs a strategy for handling temporary
  occlusion or multiple similar objects — don't assume a naive
  frame-to-frame match is sufficient without validating it.
- **Recognition** (matching against known references) needs an explicit,
  justified confidence threshold — tied to a business decision when the
  threshold has business consequences (see targeted `business-rules`
  consultation in the Computer Vision Agent).

## How this is used

The IoT Agent applies the device/communication/edge sections. The
Computer Vision Agent applies the image-processing/detection/tracking/
recognition sections. Both consult `hardware-evaluation` for the real
constraints of already-approved hardware, and `security` for device and
communication security.
