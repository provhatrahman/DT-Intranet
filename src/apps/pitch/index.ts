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

// @deprecated The Help menu now shows the paged guide in
// src/components/help/guides/pitch.tsx. This array is retained only because
// appRegistry still reads `helpItems`; it is no longer user-facing.
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
  {
    icon: "📊",
    title: "My Pitches",
    description:
      "View all your submitted pitches and their status. Pitches marked as 'Pending' are awaiting review, while 'Approved' pitches have been reviewed.",
  },
];

export { PitchAppComponent } from "./components/PitchAppComponent";
