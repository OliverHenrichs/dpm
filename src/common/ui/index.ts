/**
 * The app's UI primitives. Screens compose these rather than styling
 * `TouchableOpacity`/`Text` by hand, so feedback, touch targets,
 * accessibility and the look stay consistent and change in one place.
 */
export { default as AppText } from "./AppText";
export type { AppTextProps, TextVariant } from "./AppText";
export { default as Button } from "./Button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./Button";
export { default as Card } from "./Card";
export type { CardProps } from "./Card";
export { default as Chip } from "./Chip";
export type { ChipProps } from "./Chip";
export { default as IconButton } from "./IconButton";
export type { IconButtonProps } from "./IconButton";
export { haptics } from "./haptics";
export { default as ListRow } from "./ListRow";
export type { ListRowProps, ListRowSelection } from "./ListRow";
export { default as SegmentedControl } from "./SegmentedControl";
export type { Segment, SegmentedControlProps } from "./SegmentedControl";
