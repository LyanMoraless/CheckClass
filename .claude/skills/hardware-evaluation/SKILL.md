---
name: hardware-evaluation
description: Method for evaluating physical devices - cameras, embedded controllers, sensors, readers, gateways - considering cost, availability, reliability, compatibility, maintenance, power consumption, performance, and lifespan. Used by Tech Decision when a hardware choice is needed, and referenced by IoT and Computer Vision agents to understand the constraints of hardware already approved.
---

# Hardware Evaluation

## Purpose

The **method** for evaluating physical-device alternatives — generic and
reusable, not tied to any specific product or vendor. Actual hardware
choices are made by the Tech Decision Agent (with user approval), using
these criteria; IoT and Computer Vision agents reference the criteria to
understand *why* a piece of hardware was chosen, not to choose new
hardware themselves.

## Evaluation criteria

- **Cost** — unit cost, and total cost at the actual deployment scale
  (one device is a very different decision than a hundred).
- **Availability** — is it realistically sourceable (supply chain,
  lead time), not just a datasheet that exists.
- **Reliability** — expected failure rate, behavior under real-world
  conditions (temperature, humidity, vibration, continuous operation),
  not just lab conditions.
- **Compatibility** — with the communication protocol and backend
  architecture already approved; a technically superior device that
  doesn't fit the existing integration adds hidden cost.
- **Maintenance** — how easy it is to replace, update firmware, or
  service in the field; whether spare parts/replacement units are
  realistically available.
- **Power consumption** — relevant whenever the device isn't on constant
  reliable mains power (battery life, energy cost at scale).
- **Performance** — processing capability actually needed for the
  workload (e.g., on-device inference), not the highest spec available.
- **Lifespan** — expected operational life before replacement, and how
  that compares to the project's expected lifetime.

## Comparison structure

Same structure as `technology-evaluation` — compare real alternatives,
never decide on hardware without at least one comparison point, unless
truly no alternative exists (rare, and should be stated explicitly when
true).

## Constraints this feeds into other agents

- The **IoT Agent** needs to know the real processing/power/connectivity
  limits of approved hardware before proposing what runs at the edge vs.
  what's sent to the backend.
- The **Computer Vision Agent** needs to know camera resolution, frame
  rate, and processing headroom before committing to a detection/tracking
  approach — assessing feasibility against these real constraints, not
  assuming ideal conditions.

## How this is used

The Tech Decision Agent applies this when a hardware choice is needed,
following the same recommendation-then-approval flow as any other
technology decision. IoT and Computer Vision agents consult the resulting
constraints (recorded in `project-knowledge`) — they don't re-run this
evaluation themselves.
