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

function emitRow(boss, itemName, classTag, specTag, sourceTag, isRaid) {
    const key = `${boss}|${itemName}|${classTag}|${specTag}|${sourceTag}`; 
    if (!seenRecords.has(key)) {
        seenRecords.add(key);
        const prefix = isRaid ? "Raid" : "Full";
        flatRows.push([boss, itemName, classTag, specTag, sourceTag, prefix, specTag + " " + classTag]);
    }
}

function sortRows() {
    // Set order of name to index
    const orderMap = {};
    bossOrder.forEach((name, index) => {
      orderMap[name] = index;
    });

    flatRows.sort((a, b) => {
      // custom order for column 0 (boss name)
      const ra = orderMap[a[0]];
      const rb = orderMap[b[0]];
      if (ra !== rb) return ra-rb;

      // for all other columns (index 1+) sort normally
      for (let i = 1; i < a.length; i++) {
        const cmp = a[i].localeCompare(b[i]);
        if (cmp !== 0) return cmp;
      }

      return 0;
    });
}

function appendSpreadsheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName)
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
    } else {
        sheet.clearContents();
    }

    sortRows();
    const allRows = [["Boss", "Item", "Class", "Spec", "Source", "Type", "Tag"]].concat(flatRows);
    sheet.getRange(1, 1, allRows.length, allRows[0].length).setValues(allRows);
    ss.getRangeByName("lastUpdateBisList").setValue(dateFormatter.format(new Date()));
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
