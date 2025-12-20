export const appMetadata = {
  name: "Pitch",
  version: "1.0.0",
  creator: {
    name: "Ryo Lu",
    url: "https://ryo.lu",
  },
  github: "https://github.com/ryokun6/ryos",
  icon: "/icons/macosx/pitch.png",
};

export const helpItems = [
  {
    icon: "📝",
    title: "Pitch a Project",
    description:
      "Fill out the form with project details including name, description, key dates, venue, budget, and timelines. Submit to add it to Inbox.",
  },
  {
    icon: "📋",
    title: "Form Fields",
    description:
      "Name and Description are required. Other fields are optional but recommended to provide as much detail as possible.",
  },
  {
    icon: "✅",
    title: "Submission",
    description:
      "After submitting, your pitch will appear in the Inbox app with a 'pitch' source flag for easy identification.",
  },
];

export { PitchAppComponent } from "./components/PitchAppComponent";
