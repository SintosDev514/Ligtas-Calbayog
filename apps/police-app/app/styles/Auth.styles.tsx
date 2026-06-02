import { StyleSheet } from "react-native";
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from "../../constants/theme";

export const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: 80,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    ...shadow.card,
  },
  appName: {
    fontSize: fontSize.heading,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  appSub: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  form: {
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  inputPassword: {
    paddingRight: 44,
  },
  passwordToggle: {
    position: "absolute",
    right: 12,
    top: 14,
    padding: 4,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: borderRadius.xl,
    alignItems: "center",
    marginTop: spacing.xs,
    ...shadow.button,
  },
  actionBtnText: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.xxl,
    gap: spacing.xs,
  },
  linkText: {
    fontSize: fontSize.base,
    color: colors.textTertiary,
  },
  linkAction: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.accent,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.md,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginVertical: spacing.xxl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
  },
  // Sign up specific
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  uploadBtnText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
  },
  uploadPreview: {
    width: "100%",
    height: 180,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  uploadPreviewImage: {
    width: "100%",
    height: "100%",
  },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  pickerChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pickerChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pickerChipText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
  },
  pickerChipTextActive: {
    color: colors.white,
  },
});
