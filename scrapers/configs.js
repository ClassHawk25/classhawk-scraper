// scrapers/configs.js
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
  }
};