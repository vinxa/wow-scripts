/**
 * WoW Raid Boss Kill Checker for Google Apps Script
 * 
 * Checks whether each character in a google sheet has earned a boss-kill achievement on any of their characters.
 * Updates a named range in the sheet to reflect this.
 * 
 * Will have to update the constants
 * 
 * Expected named range format:
 * Player name | Player Server | Boss A | Boss B | ... | Boss N 
 * 
 */

/* CONSTANTS */
const BOSSES = [
  { achievementId: 41604, name: "Plexus Sentinel" },
  { achievementId: 41605, name: "Loom'ithar" },
  { achievementId: 41606, name: "Soulbinder Naazindhri" },
  { achievementId: 41607, name: "Forgeweaver Araz" },
  { achievementId: 41608, name: "The Soul Hunters" },
  { achievementId: 41609, name: "Fractillus" },
  { achievementId: 41610, name: "Nexus-King Salhadaar" },
  { achievementId: 41611, name: "Dimensius" },
];

const RANGE_NAME = "BossKilled";  // Google Sheets named range
const REGION = "us";

/* HELPERS */
function query(url, method = "get") {
  const options = {
    method: method,
    headers: {
      Accept: "application/json",
    },
    muteHttpExceptions: true,
  };
  const response = UrlFetchApp.fetch(url, options);
  try {
    return JSON.parse(response.getContentText());
  } catch (e) {
    Logger.log("Invalid JSON: " + e);
    return { Error: "Invalid or HTML response." };
  }
}
/**
 * Builds the Blizzard character achievement URL.
 */
function buildAchievementUrl(region, realm, characterName, achievementId) {
  const safeRealm = String(realm).replaceAll("'", "").trim();
  const safeName = encodeURIComponent(characterName);
  return `https://worldofwarcraft.blizzard.com/en-us/character/${region}/${safeRealm}/${safeName}/achievement/${achievementId}`;
}

/**
 * Reads BossKilled range and updates "N" cells to "Y" if character has completed the corresponding achievement.
 */
function killCheck() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let bossKillsRange = ss.getRangeByName(RANGE_NAME);
  let bossKills = bossKillsRange.getValues();

  // Start at 1 to skip header row
  for (let rowIndex = 1; rowIndex < bossKills.length; rowIndex++) {
    const row = bossKills[rowIndex];
    const name = row[0];
    const realm = row[1];
    if (!name || !realm) continue; // Skip if name or realm blank, or if its the header row

    for (let b = 0; b < BOSSES.length; b++) {
      const colIndex = 2+b; // Bosses start in third column, add b offset
      const cell = bossKills[rowIndex][colIndex];

      if (cell !== "N") continue; // If a character has already earned the achievement, don't bother updating
      
      const boss = BOSSES[b];
      if (!boss) continue;

      Logger.log(`Looking up boss id ${boss.achievementId} - ${boss.name} for ${name}-${realm}...`);
      const url = buildAchievementUrl(REGION, realm, name, boss.achievementId);
      const res = query(url);

      const newCell = bossKillsRange.getCell(rowIndex + 1, colIndex + 1); // Sheets starts at 1, not 0
      if ("Error" in res) {
        Logger.log(`Could not find character ${name}. Please check their name is valid. Marking ${newCell.getA1Notation()} as "?"`);
        newCell.setValue("?");
      } else if ("time" in res["achievement"]) {
            Logger.log(`Found time! ${name} has killed ${boss.name} :)`);
            Logger.log(`Updating cell ${newCell.getA1Notation()}...`);
            newCell.setValue("Y");
      }
    }
  }
}

