let width = 938;
let height = 705;
const showerHome = "C1";
const ss = SpreadsheetApp.getActiveSpreadsheet();
const sheet = ss.getSheetByName("WWT S2");

function showerDied() {
  let ui = SpreadsheetApp.getUi();
  if (Math.random() > 0.7) {
    ui.alert("Shower has died :(\n But he has ankh.. he will respawn...", ui.ButtonSet.OK);
  } else {
    ui.alert("Shower has died :)\n But he has ankh.. he will respawn...", ui.ButtonSet.OK);
  }
  spawnShower();
}

function deleteAll() {
  var drawings = sheet.getImages();
        drawings.forEach(drawing => {
        drawing.remove();
      });
}

function refreshSheet() {
  let tempSheet = sheet.copyTo(ss);
  ss.setActiveSheet(tempSheet);
  SpreadsheetApp.flush();
  ss.setActiveSheet(sheet);
  ss.deleteSheet(tempSheet);
}

function spawnShower() {
  //const showerUrl = "https://i.imgur.com/UqUrt9n.png";
  const showerUrl = "https://i.imgur.com/UFNqBwm.png";
  let blob = UrlFetchApp.fetch(showerUrl).getBlob();
  let home = sheet.getRange(showerHome);
  Logger.log(blob.getBytes().length);
  let drawings = sheet.getImages();
  Logger.log(drawings);
  sheet.insertImage(blob, home.getRow(), home.getColumn());
  Logger.log(drawings);
  drawings = sheet.getImages();
  Logger.log(drawings);
  drawings[0].setWidth(width);
  drawings[0].setHeight(height);
  drawings = sheet.getImages();
  Logger.log(drawings);
  refreshSheet();
}

function showerProtect() {
  let editing = sheet.getRange("A1").getValue() == " ";

  if (!editing) {
    sheet.getRange("A1").setValue(" ");
    editing = sheet.getRange("A1").getValue() == " ";
    var drawings = sheet.getImages();
    Logger.log(drawings);
    if (drawings.length == 0) {
      showerDied();
    } else if (drawings.length > 1) {
      drawings.forEach(drawing => {
        drawing.remove();
      });
      spawnShower();
    }
    SpreadsheetApp.flush();
  
    checkSize();
    drawings = sheet.getImages();
    const shower = drawings[0];
    if (shower.getAnchorCell().getA1Notation() != sheet.getRange(showerHome).getA1Notation()) {
      moveShowerSlowly();
    } else {
      sheet.getRange("A1").setValue("");
      SpreadsheetApp.flush();
    }
    
  }
}

function checkSize() {
  drawings = sheet.getImages();
    if (drawings.length == 0) {
      showerDied();
    } else if (drawings.length > 1) {
      drawings.forEach(drawing => {
        drawing.remove();
      });
      spawnShower();
    }
    SpreadsheetApp.flush();
  const shower = drawings[0];
  if (shower.getWidth() != width) {
    shower.setWidth(width);
  }
  if (shower.getHeight() != height) {
    shower.setHeight(height);
  }
}

function moveShowerSlowly() {
  Logger.log("MOVING");
  drawings = sheet.getImages();
  if (drawings.length == 0) {
      showerDied();
    } else if (drawings.length > 1) {
      drawings.forEach(drawing => {
        drawing.remove();
      });
      spawnShower();
    }
    SpreadsheetApp.flush();
  try {
  shower = drawings[0];
  let wrongPosition = shower.getAnchorCell();
  let wrongRow = wrongPosition.getRow();
  let wrongCol = wrongPosition.getColumn();
  let home = sheet.getRange(showerHome);
  let homeRow = home.getRow();
  let homeCol = home.getColumn();

  let newRow = wrongRow;
  let newCol = wrongCol;
  Logger.log(`Current Position ${wrongRow}, ${wrongCol}`);
  Logger.log(`Target Position: ${homeRow}, ${homeCol}`);
  if (newRow !== homeRow || newCol !== homeCol) {
    rowDiff = (homeRow - newRow) / 5;
    newRow = newRow + (rowDiff < 0 ? Math.floor(rowDiff) : Math.ceil(rowDiff));
    colDiff = (homeCol - newCol) / 5;
    newCol = newCol + (colDiff < 0 ? Math.floor(colDiff) : Math.ceil(colDiff));
    Logger.log(`New position: ${newRow}, ${newCol}`);
    shower.setAnchorCell(sheet.getRange(newRow, newCol));
    Utilities.sleep(1000);
    moveShowerSlowly();
    //ScriptApp.newTrigger('moveShowerSlowly')
    //.timeBased().after(1).create();
  } else {
    Logger.log("Shower is home :)");
    deleteTriggers();
    checkSize();
    sheet.getRange("A1").setValue("");
    SpreadsheetApp.flush();
  }
  } catch {
    deleteTriggers();
    sheet.getRange("A1").setValue("");
    SpreadsheetApp.flush();
  }
}

function deleteTriggers() {
  let triggers = ScriptApp.getProjectTriggers();
  for (var i=0; i<triggers.length;i++) {
    var trigger = triggers[i];
    if (trigger.getHandlerFunction() == "moveShowerSlowly") {
      ScriptApp.deleteTrigger(trigger);
    }
  }
}

