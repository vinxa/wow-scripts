function updateLootHistory() {
  const sheetName = 'wowaudit';
  let p = queryCurrentSeason();
  console.log(`Season: ${p}`);
  //let p = 13; // s13 = TWW S1.
  let l = getCharacterLootHistory(p);
  updateLootHistorySheet(l, sheetName);
}

function getCharacterLootHistory(season){
  const lootHistory = queryLootHistory(season);
  const characterMap = queryCharacters();
  const responseMap = new Map([
    ["Other", ["Other", "Autopass", "mog", "slutmog", "Candidate didn't respond on time", "Candidate is selecting response, please wait", "Pass"]],
    ["Sidegrade", ["Minor Upgrade"]],
    ["Upgrade", ["Mainspec/Need"]]
  ]);

  // Prepare a new array that will hold loot history and default data for characters without loot
  const completeLootHistory = [];

  // Iterate over all characters and either append loot data or create default empty entries
  characterMap.forEach((character) => {
    // Filter loot history for current character
    const characterLoot = lootHistory.filter(item => item.character_id === character.id);
    
    if (characterLoot.length > 0) {
      // If there is loot history, add it to the final array
      characterLoot.forEach(item => {
        // Replace extra response types with general categories
        for (const [key, values] of responseMap) {
          if (values.includes(item.response_type?.name)) {
            item.response_type = key;
          }
        }
        item.character_name = character.name;
        item.character_class = character.class;
        completeLootHistory.push(item);
      });
    } else {
      // If no loot history, create a default entry for the character
      completeLootHistory.push({
        character_id: character.id,
        character_name: character.name,
        character_class: character.class,
        item_name: '',  // Default values for fields with no data
        response_type: {'name':''},
        date: ''
      });
    }
  });

  return completeLootHistory;
}

function updateLootHistorySheet(jsonData, sheetName) {
  // Reference the sheet and clear old data
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
    throw new Error("Sheet not found!");
  }

  // Add headers
  const headers = ['character_name','name','item_id','slot','response_type','old_items','awarded_by_name','awarded_at','difficulty','note']
  sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).clearContent();
  let updateRange = sheet.getRange(1, 1, sheet.getMaxRows(), headers.length)
  const headerRange = sheet.getRange(1,1,1,headers.length);
  headerRange.setValues([headers]);

  const valueArray = [];
  // Add data rows
  jsonData.forEach(row => {
    if (row.response_type?.name?.startsWith("Personal")) { 
      return;
    }
    const values = headers.map((header) => {
      switch (header) {
        case "old_items": return row.old_items?.map((item) => `Item ID: ${item.item_id}, Bonuses: ${item.bonus_ids.join(", ")}`
        ).join(" | ") || "";
        case "response_type": return row.response_type?.name || "";
        default: 
          const value = row[header];
          return typeof value === "string" && value.startsWith("+") ? `'${value}` : value || "";
      }
    });
    valueArray.push(values);
  });

  sheet.getRange(2, 1, valueArray.length, headers.length).setValues(valueArray);
}

