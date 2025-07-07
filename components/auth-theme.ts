import { Theme } from "@aws-amplify/ui-react"

export const authTheme: Theme = {
  name: "auth-theme",
  tokens: {
    colors: {
      brand: {
        primary: {
          "80": { value: "#0F766E" }, // A dark teal color
          "90": { value: "#134E4A" }, // A darker teal for hover
        },
      },
      font: {
        inverse: { value: "#FFFFFF" }, // White color for text
      },
    },
    components: {
      button: {
        primary: {
          backgroundColor: "{colors.brand.primary.80}",
          color: "{colors.font.inverse}",
          _hover: {
            backgroundColor: "{colors.brand.primary.90}",
          },
        },
      },
      fieldcontrol: {
        _focus: {
          borderColor: "{colors.brand.primary.90}",
          boxShadow: "0 0 0 1px {colors.brand.primary.90}",
        },
      },
    },
  },
} 