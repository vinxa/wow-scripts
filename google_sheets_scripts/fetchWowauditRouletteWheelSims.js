// Updates the roulette wheel stat increases for everyone.

function closeSidebar() {
    let html = HtmlService.createHtmlOutput("<script>google.script.host.close();</script>");
    SpreadsheetApp.getUi().showSidebar(html);
}

function processInputWishlistsHtml(userInput) {
  // Use the userInput variable as needed.
  Logger.log("User input received: " + userInput);
  closeSidebar();

  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetName = "Miniature Roulette Wheel";
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } 
  sheet.getRange("O1").setValue("Updating...");

  let links = findRaidbotsLinks(userInput);
  let playersUpgrades = parseRaidbotsData(links);
  
  // unique stat keys
  let statCombosSet = {};
  for (let player in playersUpgrades) {
    if (playersUpgrades.hasOwnProperty(player)) {
      for (let stat in playersUpgrades[player]) {
        if (playersUpgrades[player].hasOwnProperty(stat)) {
          statCombosSet[stat] = true;
        }
      }
    }
  }
  let statCombos = Object.keys(statCombosSet).sort();

  // 2D array for output to sheets
  let outputData = [];
  let headers = ["Person"].concat(statCombos);
  outputData.push(headers);

  for (let person in playersUpgrades) {
    if (playersUpgrades.hasOwnProperty(person)) {
      let rowValues = [person];
      statCombos.forEach(function(stat) {
        let value = playersUpgrades[person][stat];
        rowValues.push(typeof value === 'undefined' ? "" : value);
      });
      outputData.push(rowValues);
    }
  }

  // Clear old data
  let lastRow = sheet.getLastRow();
  if (lastRow > 0) {
    sheet.getRange(1, 1, lastRow, 13).clearContent();
  }
  // Set the values starting at cell A1
  sheet.getRange(1, 1, outputData.length, outputData[0].length).setValues(outputData);
  Logger.log("Data written to sheet: " + sheetName);
  let now = new Date();
  let formattedDate = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
  sheet.getRange("O1").setValue("Last Updated: " + formattedDate);
}

function updateRouletteWheel() {
  let html = HtmlService.createHtmlOutputFromFile('rouletteWheelPrompt')
      .setTitle('Update Roulette Wheel Sims Process');
  SpreadsheetApp.getUi().showSidebar(html);
}

function findRaidbotsLinks(html) {
  let pattern = /<a href="(https:\/\/raidbots\.com\/simbot\/report\/[^"]+)"/g;
  let links = [];
  let match;
  while ((match = pattern.exec(html)) !== null) {
    links.push(match[1]);
  }
  return links;
}

function parseRaidbotsData(links) {
    let players = {};
    links.forEach(function(link) {
    let csvUrl = link + "/data.csv";
    try {
      let response = UrlFetchApp.fetch(csvUrl, { muteHttpExceptions: true });
      Logger.log("Response code: " + response.getResponseCode());
      Logger.log("Response content: " + response.getContentText());
      if (response.getResponseCode() === 200) {
        let csvContent = response.getContentText("UTF-8");
        let csvData = Utilities.parseCsv(csvContent);
        let topSims = {};
        let playerName = "";
        for (let i = 0; i < csvData.length; i++) {
          let row = csvData[i];
          if (i === 1) {
            playerName = row[0];
            topSims["current"] = row[1];
          }
          if (row[0].indexOf("/228843/") !== -1) {
            let parts = row[0].split("//");
            let stat = parts[parts.length - 1].replace(/\/$/, ""); // remove trailing slash
            if (topSims.hasOwnProperty(stat)) {
              topSims[stat] = Math.max(parseFloat(row[1]), parseFloat(topSims[stat]));
            } else {
              topSims[stat] = row[1];
            }
          }
        }
        let currentValue = parseFloat(topSims["current"]);
        players[playerName] = {};
        for (let key in topSims) {
          if (topSims.hasOwnProperty(key)) {
            if (key !== "current" && key !== "") {
              players[playerName][key] = parseFloat(topSims[key]) - currentValue;
            }
          }
        }
      }
    } catch (e) {
      Logger.log("Error fetching CSV from " + csvUrl + ": " + e);
    }
  });
  return players;
}