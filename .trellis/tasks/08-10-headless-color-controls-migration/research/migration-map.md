# 颜色控件迁移代码地图

## Existing consumers

- `PropertyInspector.tsx` imports `InspectorColorControl as ColorInput` and still renders seven old color fields across single-object appearance, QR/barcode content and multi-selection style.
- `TableContentFields.tsx` imports `InspectorColorControl as ColorField` and renders table text, background and border colors.
- Page settings already use `PtdColorField`; it is the reference host integration for `onOpenChange`, transient page updates, cancel and recent-color recording.

## Existing contracts to preserve

- Old controls expose `onStart`, `onFinish`, `onCancel`, and `onValue`; these map to `PtdColorField`'s `onOpenChange`, `onCancel`, and `onValueChange` without moving history into the primitive.
- Multi-selection uses `null` plus a mixed placeholder for conflicting values. The migrated field must keep `null` controlled and use a safe visual fallback only inside the panel.
- Table edits patch selected cells through a single batch gesture; color changes must remain transient until the existing finish boundary.
- QR/barcode backgrounds may support transparency; foreground colors do not. This must be reflected in `allowTransparent` and defaults.

## Migration constraints

- No new color picker dependency is needed. `@ptd/react-ui` already owns HSV, HEX, swatches, Portal theme and interactive boundary behavior.
- Do not delete `InspectorColorControl` until a repository search confirms no out-of-scope consumer remains; remove it in a follow-up cleanup only if the migration makes it unused.
- Verification must include a real Chromium path because old color failures were caused by native focus and Portal event boundaries, not only value conversion.
