// Set on a schedule every Tuesday Night - wipes wowaudit wishlist data.
function wipeWowAuditWishlists() {
    const rosterCharacters = queryCharacters();
    for (const id of rosterCharacters.keys()) {
      deleteWishlist(id);
  }
}

// Fetches the latest wishlist data and saves it to sheet as backup
function fetchWishlists() {
  //let headers = ["Character","Report Date", "Difficulty", "Boss", "Item Name", "Spec", "Upgrade"]
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Latest Droptimisers");
  let tableRange = sheet.getRange(2, 1, sheet.getLastRow(), 8);
  let currentData = tableRange.getValues();

  // Get latest wishlist data and transform into rows
  // find every row with that character on that spec on that difficulty and delete it before appending
  let newRows = [];
  const rosterCharacters = queryCharacters();
  const ids = Array.from(rosterCharacters.keys());
  const wishlists = queryWishlists(ids);
  const wishlistMap = new Map();
  wishlists.forEach(w => {
    if (w.data) wishlistMap.set(w.id, w.data);
  });
  
  for (const [id, c] of wishlistMap.entries()) {
    if (!c.instances) continue;
    c.instances.forEach((raid) => {
      if (raid.name === raidName) {
        raid.difficulties.forEach((difficulty) => {
          const diffName = difficulty.difficulty;
          const spec_update_times = difficulty.wishlist.report_uploaded_at;
          Object.entries(spec_update_times).forEach(([spec, updateTime]) => {
            if (updateTime != null) {
              let updatedRow = false;
              let matched = false;
              for (let i = 1; i < currentData.length; i++) {
                if (
                  currentData[i][0] === c.name &&
                  currentData[i][3] === diffName &&
                  currentData[i][1] === spec
                ) {
                  // Found a row in existing sheet with correct name, difficulty, spec.
                  matched = true;
                  if (updateTime > currentData[i][2]) {
                    console.log(`Found update for ${c.name}: ${spec} ${diffName} set at ${currentData[i][2]}. New data is at ${updateTime}`);
                    // Flag the new data to be apppended,  delete this old row.
                    updatedRow = true;
                  } else {
                    newRows.push(currentData[i]);
                  }
                }
              }
              if (updatedRow || !matched) {
                difficulty.wishlist.encounters.forEach((encounter) => {
                  encounter.items.forEach(item => {
                  console.log(`Adding ${item.name} for ${c.name} ${diffName} ${spec}`);
                  if (item["score_by_spec"].hasOwnProperty(spec)) {
                    let row = [
                      c.name,
                      spec,
                      updateTime,
                      diffName,
                      encounter.name,
                      item.name,
                      item.id,
                      item["score_by_spec"][spec]["score"]
                    ];
                    newRows.push(row);
                  }
                  });
                });
              } 
            }
          });
        });
      }
    });
  }
  tableRange.clearContent();
  // remove any blanks
  newRows = newRows.filter(inner => inner.length > 0);
  // filter out duplicate items to the highest value (e.g. miniature roulette wheel)
  newUniqueRows = Array.from(newRows.reduce((i, arr) => {
    const key = arr.slice(0,7).join(',');
    const existing = i.get(key);
    if (!existing || arr[7] > existing[7]) {
      i.set(key, arr);
    }
    return i;
  }, new Map()).values()
  );

  if (newRows.length > 0) {
    sheet.getRange(2, 1, newRows.length, newRows[0].length).setValues(newUniqueRows);
  }
}
