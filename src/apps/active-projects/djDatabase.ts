export interface DJ {
  id: string;
  name: string;
  artistName: string;
  contactDetails: string;
  location: string;
  creativeDisciplines: string;
  linksToWork: string;
  genre: string;
  timesBooked: number;
  mostRecentEvent: string;
  mostRecentEventDate: string;
}

export const dummyDJs: DJ[] = [
  {
    id: "1",
    name: "Arun Dhanjal",
    artistName: "Zar",
    contactDetails: "adjzar@gmail.com",
    location: "London",
    creativeDisciplines: "DJ / Producer / Live performer",
    linksToWork: "https://linktr.ee/ajdzar",
    genre: "Multi genre",
    timesBooked: 5,
    mostRecentEvent: "Ministry of Sound",
    mostRecentEventDate: "",
  },
  {
    id: "2",
    name: "Saadaan Afghan",
    artistName: "Saadaan",
    contactDetails: "",
    location: "Coventry / London",
    creativeDisciplines: "DJ / Producer",
    linksToWork: "saadaan.bandcamp.com\nwaveplate.systems",
    genre: "140, Dubstep, Left Field Bass, 2-step/ukg, Hip Hop, Techno, Electro (sometimes House)",
    timesBooked: 1,
    mostRecentEvent: "",
    mostRecentEventDate: "",
  },
  {
    id: "3",
    name: "Michael Diamond",
    artistName: "Michael Diamond",
    contactDetails: "diamond.sounduk@gmail.com",
    location: "Oxford/London",
    creativeDisciplines: "DJ / Producer / Live performer",
    linksToWork: "https://soundcloud.com/michaeldiamonduk",
    genre: "Electronic, Jazz",
    timesBooked: 0,
    mostRecentEvent: "",
    mostRecentEventDate: "",
  },
  {
    id: "4",
    name: "Sita Shah",
    artistName: "Sita Shah",
    contactDetails: "sitashahsworld@gmail.com",
    location: "London\nSometimes NYC",
    creativeDisciplines: "DJ / Presenter / learning to produce",
    linksToWork: "soundcloud.com/sitashahdj",
    genre: "Techno, hardcore, breaks, desi, bootlegs",
    timesBooked: 3,
    mostRecentEvent: "",
    mostRecentEventDate: "",
  },
  {
    id: "5",
    name: "Ral Daryanani",
    artistName: "Rainmann",
    contactDetails: "",
    location: "London",
    creativeDisciplines: "DJ / Producer / Live performer",
    linksToWork: "SoundCloud.com/rainm4nn",
    genre: "All",
    timesBooked: 0,
    mostRecentEvent: "",
    mostRecentEventDate: "",
  },
];

export function searchDJs(query: string, djs: DJ[]): DJ[] {
  if (!query.trim()) return djs;
  
  const lowerQuery = query.toLowerCase();
  return djs.filter(
    (dj) =>
      dj.name.toLowerCase().includes(lowerQuery) ||
      dj.artistName.toLowerCase().includes(lowerQuery) ||
      dj.location.toLowerCase().includes(lowerQuery) ||
      dj.creativeDisciplines.toLowerCase().includes(lowerQuery) ||
      dj.genre.toLowerCase().includes(lowerQuery)
  );
}

export function addDJ(dj: Omit<DJ, "id">): DJ {
  const newDJ: DJ = {
    ...dj,
    id: Date.now().toString(),
  };
  return newDJ;
}
