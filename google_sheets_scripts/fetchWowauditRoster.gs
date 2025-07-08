function updateRoster() {
  // Reference the sheet and clear old data
  const sheetName = 'Helper Data';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Sheet not found!");
  }

  const charMap = queryCharacters();
  const values = [];
  charMap.forEach(character => {
    values.push([character.name, character.class]);
  });

  values.sort(function(a,b) {
    return a[1].localeCompare(b[1]);
  });

  sheet.getRange(2,3,sheet.getMaxRows(), 2).clearContent();
  sheet.getRange(2,3,values.length,2).setValues(values);
}
