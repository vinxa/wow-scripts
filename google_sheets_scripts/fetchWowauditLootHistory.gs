function getCharacterLootHistory(season){
  const lootHistory = queryLootHistory(season);
  const characterMap = queryCharacters();
  
  const normaliseResponse = (resp) => {
    const name = typeof resp === 'string' ? resp : (resp?.name || '');
    if (name.startsWith('Personal')) return { normalised: 'Personal', isPersonal: true };
    if (["Other", "Autopass", "mog", "slutmog", "Candidate didn't respond on time",
      "Candidate is selecting response, please wait", "Pass"
      ].includes(name)) return { normalised: 'Other', isPersonal: false };
    if (name === "Minor Upgrade") return { normalised: 'Sidegrade', isPersonal: false };
    if (name === "Mainspec/Need") return { normalised: 'Upgrade', isPersonal: false };
    return { normalised: name, isPersonal: false };
  };

  // loot history & default record for those without loot
  const completeLootHistory = [];
  characterMap.forEach((character) => {
    const characterLoot = lootHistory.filter(item => item.character_id === character.id);

    // Normalise response types, check for ONLY received personal loot.
    const nonPersonal = [];
    for (const item of characterLoot) {
      const {normalised, isPersonal} = normaliseResponse(item.response_type);
      if (isPersonal) continue;
      const copy = {...item};
      copy.response_type = normalised;
      copy.character_name = character.name;
      copy.character_class = character.class;
      nonPersonal.push(copy);
    }

    if (nonPersonal.length > 0) {
      completeLootHistory.push(...nonPersonal);
    } else {
      // If no loot history, create a default entry for the character
      completeLootHistory.push({
        character_id: character.id,
        character_name: character.name,
        character_class: character.class,
        item_name: '',
        response_type: '',
        date: ''
      });
    }
  });

  return completeLootHistory;
}

function updateLootHistorySheet(jsonData, sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
    throw new Error("Sheet not found!");
  }

  // Add headers
  const headers = ['character_name','name','item_id','slot','response_type','old_items','awarded_by_name','awarded_at','difficulty','note']
  sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).clearContent();
  const headerRange = sheet.getRange(1,1,1,headers.length);
  headerRange.setValues([headers]);

  const valueArray = [];
  // Add data rows
  jsonData.forEach(row => {
    const values = headers.map((header) => {
      switch (header) {
        case "old_items": return row.old_items?.map((item) => `Item ID: ${item.item_id}, Bonuses: ${item.bonus_ids.join(", ")}`
        ).join(" | ") || "";
        default: 
          const value = row[header];
          return typeof value === "string" && value.startsWith("+") ? `'${value}` : value || "";
      }
    });
    valueArray.push(values);
  });

  sheet.getRange(2, 1, valueArray.length, headers.length).setValues(valueArray);
}

function updateLootHistory() {
  const sheetName = 'Loot History';
  let p = queryCurrentSeason();
  console.log(`Season: ${p}`);
  let l = getCharacterLootHistory(p);
  updateLootHistorySheet(l, sheetName);
  SpreadsheetApp.getActiveSpreadsheet().getRangeByName("lastUpdateLootHistory").setValue(dateFormatter.format(new Date()));
  SpreadsheetApp.flush();
}