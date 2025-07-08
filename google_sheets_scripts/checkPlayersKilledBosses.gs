function query(url, method="get") {
    const options = {
    'method': method,
    'headers': { 
      'Accept': 'application/json' 
      },
      'muteHttpExceptions': true
  };
  Logger.log(url);
  const response = UrlFetchApp.fetch(url, options);
  Logger.log(response.getContentText()); 
  return JSON.parse(response.getContentText());
}
let bossID = {
  1:41229, // Vexie
  2:41230, // CoC
  3:41231, // Rik
  4:41232, // Stix
  5:41233, // Sprocket
  6:41234, // Bandit
  7:41235, // Mugzee
  8:41236 // Gally
}

function killCheck() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let bossKillsRange = ss.getRangeByName("BossKilled");
  let bossKills = bossKillsRange.getValues();

  bossKills.forEach((row, rindex) => {
    if (rindex != 0 && row[0] != "") {
      row.forEach((cell, cindex) => {
        if (cindex > 1 && cell == "N") {
          Logger.log(row[1]);
          Logger.log(row[0]);
          Logger.log(bossID[cindex-1]);
          let r = query(`https://worldofwarcraft.blizzard.com/en-us/character/us/${row[1]}/${row[0]}/achievement/${bossID[cindex-1]}`);
          if ('time' in r["achievement"]) {
          let newCell = bossKillsRange.getCell(rindex+1, cindex+1);
          newCell.setValue("Y");
          }
        }
      });
    }
  });
}
