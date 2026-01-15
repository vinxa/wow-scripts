/**
 * Scrapes BiS data from Icy Veins, flattening into single rows for each item.
 *
 */

const ivUrltasks = [];

function findIvTables(html) {
    const ids = ["area_1", "area_2", "area_3", "overall", "raid"];
    const tables = [];
    ids.some(id => {
        const idx = html.indexOf(`id="${id}"`);
        if (idx === -1) return false;
        const tableStart = html.indexOf("<table", idx);
        if (tableStart === -1) return false;
        const tableEnd = html.indexOf("</table>", tableStart);
        if (tableEnd === -1) return false;
        tables.push(html.substring(tableStart, tableEnd + 8));
        return tables.length === 2;
    });
    return tables;
}

function extractIvRows(tableHtml) {
  // find all <tr> -> </tr>
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows = [];
    let m;
    while ((m = rowRegex.exec(tableHtml)) !== null) {
        rows.push(m[1]);
    }

    return rows.slice(1).filter(row => {
      const firstCell = row.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    return firstCell && !stripTags(firstCell[1]).includes("Alternative");
  });
}

function processIvRow(rowHtml, wowClass, wowSpec, isRaid) {
  const classFrag = toTitleCase(wowClass.replace("-", " "));
  const specFrag = toTitleCase(wowSpec.replace("-", " "));

  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const cells = [];
  let c;
  while ((c = cellRegex.exec(rowHtml)) !== null) {
    cells.push(c[1]);
  }

  if (cells.length < 2) return;
  const slotName = stripTags(cells[0]);

  const tierPhrase = classTierDict[wowClass] || [];
  const spanRegex = /<span[^>]*class="q4"[^>]*>([\s\S]*?)<\/span>/gi;

  let s;
  while ((s = spanRegex.exec(cells[1])) !== null) {
    let itemName = stripTags(s[1]);

    // Tier-drop lookup
    if (itemName.includes(tierPhrase)) {
      const slotPrefix = tierSlotDict[slotName];
      if (slotPrefix) {
        itemName = `${tierTokenDict[wowClass]} ${slotPrefix}}`;
      }
    }

    const boss = itemBossDict[itemName];
    if (boss) {
      emitRow(boss, itemName, classFrag, specFrag, "IV", isRaid);
    }
  }
}

function scrapeIV() {
    for (const wowClass in wowClassDict) {
        const specList = wowClassDict[wowClass];
        for (const wowSpec in specList) {
            const url = `https://www.icy-veins.com/wow/${wowSpec}-${wowClass}-pve-${specList[wowSpec]}-gear-best-in-slot`;
            ivUrltasks.push({wowClass, wowSpec, url});
        }
    }
    
    // Query concurrently
    const responses = UrlFetchApp.fetchAll(ivUrltasks.map(t => t.url));
    for (let i = 0; i < ivUrltasks.length; i++) {
        const {wowClass, wowSpec} = ivUrltasks[i];
        const resp = responses[i];
        if (resp.getResponseCode() !== 200) {
            Logger.log(`Failed ${tasks[i].url}: ${resp.getResponseCode()}`);
            continue;
        }
        const html = resp.getContentText();
        const tables = findIvTables(html);
        tables.forEach((tableHtml, idx) => {
            extractIvRows(tableHtml).forEach(rowHtml => {
              processIvRow(rowHtml, wowClass, wowSpec, idx === 1);
            });
        });
    }
}