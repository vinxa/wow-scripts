/**
 * Scrapes BiS data from IV/WH & writes into google sheet.
 *
 * Entry: updateBisLists()
 */

// Args
const sheetName = "bisList";

// Vars
const flatRows = [];
const seenRecords = new Set();

// Static data - update each expansion
const tierSlotDict = {
    "Helm":"Gilded",
    "Head":"Gilded",
    1:"Gilded",
    "Shoulder":"Polished",
    "Shoulders":"Polished",
    3:"Polished",
    "Chest":"Greased", 
    20:"Greased",
    5:"Greased",
    "Legs":"Rusty",
    7:"Rusty",
    "Gloves":"Bloody",
    "Hands":"Bloody",
    "Hand":"Bloody",
    10:"Bloody"
}

const classTierDict = {
    "death-knight": "Cauldron Champion",
    "demon-hunter": "Fel-Dealer",
    "druid": "Reclaiming Blight",
    "evoker": "Opulent Treasurescale",
    "hunter": "Tireless Collector",
    "mage": "Aspectral Emissary",
    "monk": "Ageless Serpent",
    "paladin": "Aureate Sentry",
    "priest": "Confessor's Unshakable",
    "rogue": "Spectral Gambler",
    "shaman": "Gale Sovereign",
    "warlock": "Spliced Fiendtrader",
    "warrior": "Enforcer's Backalley"
}

const tierTokenDict = {
    "all":"Gallybux",
    "death-knight":"Dreadful",
    "demon-hunter":"Dreadful",
    "druid":"Mystic",
    "evoker":"Zenith",
    "hunter":"Mystic",
    "mage":"Mystic",
    "monk":"Zenith",
    "paladin":"Venerated",
    "priest":"Venerated",
    "rogue":"Zenith",
    "shaman":"Venerated",
    "warlock":"Dreadful",
    "warrior":"Zenith"
};

const itemBossDict = {
    "Tune-Up Toolbelt": "Vexie and the Geargrinders",
    "Pit Doctor's Petticoat": "Vexie and the Geargrinders",
    "Vandal's Skullplating": "Vexie and the Geargrinders",
    "Dragster's Last Stride": "Vexie and the Geargrinders",
    "Blazer of Glory": "Vexie and the Geargrinders",
    "Shrapnel-Ridden Sabatons": "Vexie and the Geargrinders",
    "Fullthrottle Facerig": "Vexie and the Geargrinders",
    "Revved-Up Vambraces": "Vexie and the Geargrinders",
    "Undercircuit Racing Flag": "Vexie and the Geargrinders",
    "Blastfurious Machete": "Vexie and the Geargrinders",
    "Greasemonkey's Shift-Stick": "Vexie and the Geargrinders",
    "Geargrinder's Spare Keys": "Vexie and the Geargrinders",
    "Vexie's Pit Whistle": "Vexie and the Geargrinders",
    "Hotstep Heel-Turners": "Cauldron of Carnage",
    "Competitor's Battle Cord": "Cauldron of Carnage",
    "Galvanic Graffiti Cuffs": "Cauldron of Carnage",
    "Heaviestweight Title Belt": "Cauldron of Carnage",
    "Faded Championship Ring": "Cauldron of Carnage",
    "Crowd Favorite": "Cauldron of Carnage",
    "Tournament Arc": "Cauldron of Carnage",
    "Superfan's Beater-Buzzer": "Cauldron of Carnage",
    "Flarendo's Pilot Light": "Cauldron of Carnage",
    "Torq's Big Red Button": "Cauldron of Carnage",
    "Dreadful Bloody Gallybux": "Cauldron of Carnage",
    "Mystic Bloody Gallybux": "Cauldron of Carnage",
    "Venerated Bloody Gallybux": "Cauldron of Carnage",
    "Zenith Bloody Gallybux": "Cauldron of Carnage",
    "Underparty Admission Bracelet": "Rik Reverb",
    "Killer Queen's Wristflickers": "Rik Reverb",
    "Sash of the Fierce Diva": "Rik Reverb",
    "Rik's Walkin' Boots": "Rik Reverb",
    "Semi-Charmed Amulet": "Rik Reverb",
    "Pyrotechnic Needle-Dropper": "Rik Reverb",
    "Remixed Ignition Saber": "Rik Reverb",
    "Frontman's Wondrous Wall": "Rik Reverb",
    "Reverb Radio": "Rik Reverb",
    "Dreadful Polished Gallybux": "Rik Reverb",
    "Mystic Polished Gallybux": "Rik Reverb",
    "Venerated Polished Gallybux": "Rik Reverb",
    "Zenith Polished Gallybux": "Rik Reverb",
    "Cleanup Crew's Wastemask": "Stix Bunkjunker",
    "Bilgerat's Discarded Slacks": "Stix Bunkjunker",
    "Sanitized Scraphood": "Stix Bunkjunker",
    "Dumpmech Compactors": "Stix Bunkjunker",
    "Stix's Metal Detector": "Stix Bunkjunker",
    "Dumpster Diver": "Stix Bunkjunker",
    "Junkmaestro's Mega Magnet": "Stix Bunkjunker",
    "Scrapfield 9001": "Stix Bunkjunker",
    "Dreadful Rusty Gallybux": "Stix Bunkjunker",
    "Mystic Rusty Gallybux": "Stix Bunkjunker",
    "Venerated Rusty Gallybux": "Stix Bunkjunker",
    "Zenith Rusty Gallybux": "Stix Bunkjunker",
    "Refiner's Conveyor Belt": "Sprocketmonger Lockenstock",
    "Rushed Beta Launchers": "Sprocketmonger Lockenstock",
    "Gravi-Gunk Handlers": "Sprocketmonger Lockenstock",
    "Test Subject's Clasps": "Sprocketmonger Lockenstock",
    "Test Pilot's Go-Pack": "Sprocketmonger Lockenstock",
    "GIGADEATH Chainblade": "Sprocketmonger Lockenstock",
    "Alphacoil Ba-Boom Stick": "Sprocketmonger Lockenstock",
    "Mister Lock-N-Stalk": "Sprocketmonger Lockenstock",
    "Mister Pick-Me-Up": "Sprocketmonger Lockenstock",
    "Dreadful Greased Gallybux": "Sprocketmonger Lockenstock",
    "Mystic Greased Gallybux": "Sprocketmonger Lockenstock",
    "Venerated Greased Gallybux": "Sprocketmonger Lockenstock",
    "Zenith Greased Gallybux": "Sprocketmonger Lockenstock",
    "Bottom-Dollar Blouse": "One-Armed Bandit",
    "Hustler's Ante-Uppers": "One-Armed Bandit",
    "Dubious Table-Runners": "One-Armed Bandit",
    "Coin-Operated Girdle": "One-Armed Bandit",
    "Miniature Roulette Wheel": "One-Armed Bandit",
    "Random Number Perforator": "One-Armed Bandit",
    "Giga Bank-Breaker": "One-Armed Bandit",
    "Best-in-Slots": "One-Armed Bandit",
    "Gallagio Bottle Service": "One-Armed Bandit",
    "House of Cards": "One-Armed Bandit",
    "Dreadful Gilded Gallybux": "One-Armed Bandit",
    "Mystic Gilded Gallybux": "One-Armed Bandit",
    "Venerated Gilded Gallybux": "One-Armed Bandit",
    "Zenith Gilded Gallybux": "One-Armed Bandit",
    "Underboss's Tailored Mantle": "Mug'Zee",
    "Cemented Murloc-Swimmers": "Mug'Zee",
    "Enforcer's Sticky Fingers": "Mug'Zee",
    "Hitman's Holster": "Mug'Zee",
    "Epaulettes of Failed Enforcers": "Mug'Zee",
    "Made Manacles": "Mug'Zee",
    '"Bullet-Proof" Vestplate': "Mug'Zee",
    "Hired Muscle's Legguards": "Mug'Zee",
    "Gobfather's Gifted Bling": "Mug'Zee",
    "Capo's Molten Knuckles": "Mug'Zee",
    "Big Earner's Bludgeon": "Mug'Zee",
    "Wiseguy's Refused Offer": "Mug'Zee",
    '"Tiny Pal"': "Mug'Zee",
    "Mug's Moxie Jug": "Mug'Zee",
    "Zee's Thug Hotline": "Mug'Zee",
    "Illicit Bankroll Bracers": "Chrome King Gallywix",
    "Golden Handshakers": "Chrome King Gallywix",
    "Darkfuse Racketeer's Tricorne": "Chrome King Gallywix",
    '"Streamlined" Cartel Uniform': "Chrome King Gallywix",
    "Dealer's Covetous Chain": "Chrome King Gallywix",
    "Deep-Pocketed Pantaloons": "Chrome King Gallywix",
    "Paydirt Pauldrons": "Chrome King Gallywix",
    "Cutthroat Competition Stompers": "Chrome King Gallywix",
    "The Jastor Diamond": "Chrome King Gallywix",
    "Gallywix's Iron Thumb": "Chrome King Gallywix",
    "Capital Punisher": "Chrome King Gallywix",
    "Titan of Industry": "Chrome King Gallywix",
    "Chromebustible Bomb Suit": "Chrome King Gallywix",
    "Eye of Kezan": "Chrome King Gallywix",
    "Excessively Bejeweled Curio": "Chrome King Gallywix"
};

const wowClassDict = {
    "death-knight": {
        frost: "dps",
        blood: "tank",
        unholy: "dps",
    },
    "demon-hunter": {
        vengeance: "tank",
        havoc: "dps",
    },
    "druid": {
        balance: "dps",
        guardian: "tank",
        feral: "dps",
        restoration: "healing",
    },
    "evoker": {
        augmentation: "dps",
        preservation: "healing",
        devastation: "dps",
    },
    "hunter": {
        "beast-mastery": "dps",
        survival: "dps",
        marksmanship: "dps",
    },
    "mage": {
        frost: "dps",
        fire: "dps",
        arcane: "dps",
    },
    "monk": {
        brewmaster: "tank",
        mistweaver: "healing",
        windwalker: "dps",
    },
    "paladin": {
        retribution: "dps",
        protection: "tank",
        holy: "healing",
    },
    "priest": {
        shadow: "dps",
        holy: "healing",
        discipline: "healing",
    },
    "rogue": {
        outlaw: "dps",
        assassination: "dps",
        subtlety: "dps",
    },
    "shaman": {
        restoration: "healing",
        elemental: "dps",
        enhancement: "dps",
    },
    "warlock": {
        affliction: "dps",
        destruction: "dps",
        demonology: "dps",
    },
    "warrior": {
        arms: "dps",
        fury: "dps",
        protection: "tank",
    },
};

// Helpers
function toTitleCase(str) {
    return str.replace(
        /\w\S*/g,
        text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
}

function stripTags(html) {
    const decoded = html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
    return decoded.replace(/<[^>]*>/g, "").trim();
}

function emitRow(boss, itemName, classTag, specTag, isRaid, sourceTag) {
    const key = `${boss}|${itemName}|${classTag}|${specTag}|${sourceTag}`; 
    if (!seenRecords.has(key)) {
        seenRecords.add(key);
        const prefix = isRaid ? "Raid" : "Full";
        flatRows.push([boss, itemName, prefix, classTag, specTag, sourceTag]);
    }
}

function appendSpreadsheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName)
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
    } else {
        sheet.clearContents();
    }
    const allRows = [["Boss", "Item", "Type", "Class", "Spec", "Source"]].concat(flatRows);
    sheet.getRange(1, 1, allRows.length, allRows[0].length).setValues(allRows);
    SpreadsheetApp.flush();
}

// Entry
function updateBisLists() {
    scrapeIV();
    Logger.log("IV BiS lists scraped.");
    scrapeWH();
    Logger.log("WH BiS lists scraped.");
    Logger.log('Updating spreadsheet...')
    appendSpreadsheet();
    Logger.log("BiS list update complete.");
}
