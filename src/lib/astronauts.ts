/** Artemis II crew data — hardcoded from NASA bios */

export interface Astronaut {
  name: string;
  role: string;
  agency: string;
  photo: string;
  nationality: string;
  stats: {
    missions: number;
    spaceflightTime: string;
    evaTime: string;
    background: string;
  };
  bio: string;
  funFact: string;
}

export const CREW: Astronaut[] = [
  {
    name: "Reid Wiseman",
    role: "Commander",
    agency: "NASA",
    photo: "/crew/wiseman.webp",
    nationality: "USA",
    stats: {
      missions: 2,
      spaceflightTime: "165+ days",
      evaTime: "13h 02m",
      background: "Navy Test Pilot",
    },
    bio: "Selected as NASA astronaut in 2009. Served as ISS Expedition 41 flight engineer. Former Chief of the Astronaut Office.",
    funFact: "Was the first NASA astronaut to use Vine from space.",
  },
  {
    name: "Victor Glover",
    role: "Pilot",
    agency: "NASA",
    photo: "/crew/glover.webp",
    nationality: "USA",
    stats: {
      missions: 2,
      spaceflightTime: "167+ days",
      evaTime: "26h 07m",
      background: "Navy Fighter Pilot",
    },
    bio: "SpaceX Crew-1 pilot, first Black astronaut on a long-duration ISS mission. F/A-18 pilot with over 3,000 flight hours.",
    funFact: "Kept a journal during his ISS mission and shared it publicly.",
  },
  {
    name: "Christina Koch",
    role: "Mission Specialist",
    agency: "NASA",
    photo: "/crew/koch.webp",
    nationality: "USA",
    stats: {
      missions: 2,
      spaceflightTime: "328+ days",
      evaTime: "42h 15m",
      background: "Electrical Engineer",
    },
    bio: "Holds the record for longest single spaceflight by a woman (328 days). Participated in the first all-female spacewalk.",
    funFact: "Worked at a research station in Antarctica before becoming an astronaut.",
  },
  {
    name: "Jeremy Hansen",
    role: "Mission Specialist",
    agency: "CSA",
    photo: "/crew/hansen.webp",
    nationality: "Canada",
    stats: {
      missions: 1,
      spaceflightTime: "First flight",
      evaTime: "N/A",
      background: "CF-18 Fighter Pilot",
    },
    bio: "Canadian Space Agency astronaut. First Canadian to travel beyond low Earth orbit. Former CF-18 fighter pilot and NORAD mission commander.",
    funFact: "This is his first spaceflight, and it's to the Moon.",
  },
];
