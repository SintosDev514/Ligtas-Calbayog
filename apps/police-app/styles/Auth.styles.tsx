import { StyleSheet } from "react-native";

const DEEP_NAVY = "#001A4D";
const POLICE_BLUE = "#0D47A1";
const ROYAL_BLUE = "#2563EB";
const SILVER_WHITE = "#F5F7FA";
const DARK_NAVY = "#000B26";

export const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DEEP_NAVY,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 36,
  },
  logoImage: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  appNameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  appNameLigtas: {
    fontSize: 28,
    fontWeight: "800",
    color: SILVER_WHITE,
    letterSpacing: 1,
  },
  appNameCalbayog: {
    fontSize: 28,
    fontWeight: "800",
    color: ROYAL_BLUE,
    letterSpacing: 1,
  },
  appSub: {
    fontSize: 12,
    color: "rgba(245,247,250,0.5)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(245,247,250,0.6)",
    marginBottom: 4,
    marginLeft: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "rgba(245,247,250,0.07)",
    borderWidth: 1,
    borderColor: "rgba(37,107,235,0.2)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: SILVER_WHITE,
  },
  inputFocused: {
    borderColor: ROYAL_BLUE,
    borderWidth: 1.5,
  },
  inputPasswordWrap: {
    position: "relative",
  },
  inputPassword: {
    paddingRight: 44,
  },
  passwordToggle: {
    position: "absolute",
    right: 12,
    top: 12,
    padding: 4,
  },
  actionBtn: {
    backgroundColor: POLICE_BLUE,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
    shadowColor: ROYAL_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionBtnText: {
    color: SILVER_WHITE,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 28,
    gap: 4,
  },
  linkText: {
    fontSize: 13,
    color: "rgba(245,247,250,0.4)",
  },
  linkAction: {
    fontSize: 13,
    fontWeight: "700",
    color: ROYAL_BLUE,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  // Sign up specific
  row: {
    flexDirection: "row",
    gap: 12,
  },
  half: {
    flex: 1,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(37,107,235,0.2)",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 24,
    backgroundColor: "rgba(245,247,250,0.04)",
    gap: 8,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(245,247,250,0.4)",
  },
  uploadPreview: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(37,107,235,0.2)",
  },
  uploadPreviewImage: {
    width: "100%",
    height: "100%",
  },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pickerChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(37,107,235,0.2)",
    backgroundColor: "rgba(245,247,250,0.05)",
  },
  pickerChipActive: {
    backgroundColor: POLICE_BLUE,
    borderColor: POLICE_BLUE,
  },
  pickerChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(245,247,250,0.4)",
  },
  pickerChipTextActive: {
    color: SILVER_WHITE,
  },
});
