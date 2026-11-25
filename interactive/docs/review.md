

## Offline access review

Added only a header App status icon and the offline save/update/recovery flow. Learners choose Save offline copy before disconnecting; readiness follows verification of every promised byte, including optional Python. Opening status or checking versions does not run examples or download the whole course. Existing reading order, prerequisites, experiments, controls, navigation and storage keys remain. Modal feedback names actions and preserves earlier results. Busy work and failed storage prevent restart. See [offline design](offline-update-design.md) and regression test evidence. Learning effectiveness remains unmeasured.

Offline removal regression: a delayed pre-removal verification cannot restore a deleted copy’s ready status. The browser test holds a genuine worker STATUS reply across removal and checks the status after releasing it.
