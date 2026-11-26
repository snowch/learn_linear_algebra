

## Offline access review

Added only a header App status icon and the offline save/update/recovery flow. Learners choose Save offline copy before disconnecting; readiness follows verification of every promised byte, including optional Python. Opening status or checking versions does not run examples or download the whole course. Existing reading order, prerequisites, experiments, controls, navigation and storage keys remain. Modal feedback names actions and preserves earlier results. Busy work and failed storage prevent restart. See [offline design](offline-update-design.md) and regression test evidence. Learning effectiveness remains unmeasured.

Offline removal regression: a delayed pre-removal verification cannot restore a deleted copy’s ready status. The browser test holds a genuine worker STATUS reply across removal and checks the status after releasing it.

The header offline icon starts disabled and is enabled only after its dialog handlers are installed. A browser fixture delays that module and checks both states, preventing a visible but inactive first click on slow connections.

## Shared header icon controls

UX and learning-design review: compact Material 3 theme/offline actions replace header text controls; 48px targets, action labels, tooltips and focus outlines preserve discoverability and keyboard access. Existing native theme handlers, offline verification, saved work, runner controls and subject-specific links remain authoritative. The saved badge requires a verified current offline copy; an update dot identifies an offered update. Go keeps a status icon because it offers no complete offline copy. No lesson sequence, teaching claims or prerequisites change. Review phone/tablet/desktop, both themes, keyboard, storage denial and the real save/update state transitions. Functional evidence is recorded with the change; it does not establish learning effectiveness.


## Visible header labels (2026-11-26)

UX and learning-design review: retain the Material symbols and add visible
**Offline** and **Theme** labels so touch users can identify the actions without
a tooltip. The Code runner name and state, subject-specific tools, native theme
preferences and verified offline/update badges remain. Controls fit their text,
use at least 48px touch targets, and wrap on narrow screens rather than hiding
labels. No execution, lesson instructions, progress or saved-work contract changes.
The shared [course design guide](https://github.com/snowch/cuda-python-lab/blob/main/docs/course-design-guide.md#theme-and-offline-icons)
records this rule. Validation covers the built header at 320, 390, 820 and 1440px
in both themes, keyboard focus, modal opening/Escape, persistence and project-local
asset requests. Functional checks do not establish learning effectiveness.
