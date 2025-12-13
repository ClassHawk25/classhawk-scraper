// scrapers/configs.js
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const bsportStudios = JSON.parse(readFileSync(join(__dirname, '../data/bsport-london-studios.json'))).studios;

export default {
  // ✅ FIXED: Changed 'onerebel' to '1rebel' so it matches your command flag
  '1rebel': {
    url: 'https://www.1rebel.com/uk/buy/book-a-class', // Updated to the direct booking URL
    studioName: '1Rebel'
  },

  // Psycle
  psycle: {
    locations: [
      'https://psyclelondon.com/pages/bank-timetable',
      'https://psyclelondon.com/pages/oxford-circus-timetable',
      'https://psyclelondon.com/pages/shoreditch-timetable',
      'https://psyclelondon.com/pages/notting-hill-timetable',
      'https://psyclelondon.com/pages/victoria-timetable'
    ],
    studioName: 'Psycle'
  },

  // 3Tribes
  threetribes: {
    locations: [
      'https://www.3tribes.co.uk/borough-book-now/',
      'https://www.3tribes.co.uk/crouchend-book-now/'
    ],
    studioName: '3Tribes'
  },

  // BST Lagree
  bstlagree: {
    url: 'https://bstlagree.com/book/',
    studioName: 'BST Lagree'
  },

  // Virgin Active
  virginactive: {
    locations: [
      'https://www.virginactive.co.uk/clubs/crouch-end/timetable/'
    ],
    studioName: 'Virgin Active'
  },

  // Shiva Shakti (BSport)
  shivashakti: {
    url: 'https://shivashaktistudios.com/schedule/',
    studioName: 'Shiva Shakti'
  },

  // Barry's UK (Mariana Tek)
  barrys: {
    url: 'https://www.barrys.com/schedule/london-east/?_mt=%2Fschedule',
    studioName: "Barry's"
  },

  // MindBody Network (API-based discovery)
  mindbody: {
    studioName: 'MindBody Network',
    zones: [
      { name: 'Central London', lat: 51.5074, lng: -0.1278, radius: 2, maxStudios: 30 },
      { name: 'Shoreditch', lat: 51.5255, lng: -0.0779, radius: 2, maxStudios: 20 },
      { name: 'Kensington', lat: 51.4941, lng: -0.1740, radius: 2, maxStudios: 15 },
      { name: 'Camden', lat: 51.5390, lng: -0.1426, radius: 2, maxStudios: 15 },
      { name: 'Clapham', lat: 51.4620, lng: -0.1680, radius: 2, maxStudios: 15 },
    ]
  },

  // BSport Studios (API-based) - 182 London studios from discovery
  bsport: {
    studioName: 'BSport Studios',
    studios: bsportStudios
  },

  // Frame London (MarianaTek API)
  frame: {
    studioName: 'Frame',
    apiUrl: 'https://frame.marianatek.com/api/customer/v1',
    regionId: '48541'
  }
};
