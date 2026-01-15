/**
 * Scrapes BiS data from Wowhead,
 * flattening into single rows for each item.
 *
 */

const whUrltasks = [];

/**
 * Wowhead injects the items into the table via javascript, but it 
 * doesn't retrieve them from a server, it just grabs it from
 * some json stored in the page with every expansion's bis? (lol). 
 * 
 * This isolates that json from the rest of the page,
 * to convert to objects containing each item name and ID.
 */
function findWhJson(html) {
  const rx = /WH\.Gatherer\.addData\(3,\s*(?:10|1),\s*(\{[\s\S]*?\})\)/;
  const m = html.match(rx);
  if (!m) throw new Error("Could not find item JSON");
  return JSON.parse(m[1]);
}

/**
 * The first table on wowhead has the overall BIS items.
 */
function findWhFirstTable(html) {
  const rx1 = /(\[table class=grid width=900px][\s\S]*?\[\\+\/table])(?=[\s\S]*?\[tab name=\\"Raid\\")/;
  const rx2 = /\[tab name=\\"For Raid[\s\S]*?\[\\+\/table]/; // mistweaver page by intent, not by source.
  return (html.match(rx1) || html.match(rx2) || [])[0] || "";
}

function parseWhItemTable(block, json) {
  const rows = block.match(/\[item=(\d+)/g) || [];
  return rows.map(r => {
    const id = r.match(/\d+/)[0];
    const data = json[id];
    if (data) {
    return {
      name: data.name_enus,
      isTier: !!(data.jsonequip?.classes),
      slot: data.jsonequip?.slotbak,
      id: id
    };
    }
    return null;
  }).filter(item => item !== null);
}

function processWhItems(items, wowClass, wowSpec, isRaid) {
    const classFrag = toTitleCase(wowClass.replace("-", " "));
    const specFrag = toTitleCase(wowSpec.replace("-", " "));
    const tierPhrase = classTierDict[wowClass] || [];

    for (const { name, isTier, slot, id} of items) {
      let itemName = name;
      // Tier-drop lookup
      if (isTier && itemName.indexOf(tierPhrase) !== -1) {
        const slotPrefix = tierSlotDict[slot];
        if (slotPrefix) {
          itemName = `${tierTokenDict[wowClass]} ${slotPrefix}}`;
        }
      }
            // Direct BIS lookup
            const boss = itemBossDict[itemName];
            if (boss) {
                emitRow(boss, itemName, classFrag, specFrag, "WH", isRaid);
            }
    }
}

function scrapeWH() {
    for (const wowClass in wowClassDict) {
        const specList = wowClassDict[wowClass];
        for (const wowSpec in specList) {
            const url = `https://www.wowhead.com/guide/classes/${wowClass}/${wowSpec}/bis-gear`;
            whUrltasks.push({wowClass, wowSpec, url});
        }
    }
    
    // Query concurrently
    const responses = UrlFetchApp.fetchAll(whUrltasks.map(t => t.url));
    for (let i = 0; i < whUrltasks.length; i++) {
        const {wowClass, wowSpec} = whUrltasks[i];
        const resp = responses[i];
        if (resp.getResponseCode() !== 200) {
            Logger.log(`Failed ${tasks[i].url}: ${resp.getResponseCode()}`);
            continue;
        }
        const html = resp.getContentText();
        const jsonItems = findWhJson(html);
        const overallItems = parseWhItemTable(findWhFirstTable(html), jsonItems);
        const allItems = parseWhItemTable(html, jsonItems);

        processWhItems(overallItems, wowClass, wowSpec, false);
        processWhItems(allItems, wowClass, wowSpec, true);
    }
}