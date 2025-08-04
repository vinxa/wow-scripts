const token = PropertiesService.getScriptProperties().getProperty("API_TOKEN");

function query(url, method="get") {
    const options = {
    'method': method,
    'headers': { 
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json' 
      }
  };
  const response = UrlFetchApp.fetch(url, options);
  return JSON.parse(response.getContentText());
}

function queryCurrentSeason() {
  const seasonData = query('https://wowaudit.com/v1/period');
  const currentSeason = seasonData.current_season?.keystone_season_id;
  if (!currentSeason) {
    throw new Error('current_season value is missing from the first API response');
  }
  return currentSeason;
}

function queryLootHistory(season) {
  const jsonData = query(`https://wowaudit.com/v1/loot_history/${season}`);
  return jsonData.history_items;
}

function queryCharacters() {
  const characterList = query(`https://wowaudit.com/v1/characters`);
  const characterMap = new Map();
    characterList.forEach(character => {
    characterMap.set(character.id, character);
  });
  return characterMap;
}

function deleteWishlist(characterId) {
  const deletedReq = query(`https://wowaudit.com/v1/wishlists/${characterId}`, "delete");
  if (deletedReq.success != true) {
    console.Error("Delete request failed ", deletedReq);
  }
}

function queryWishlist(characterId) {
  const wishlistData = query(`https://wowaudit.com/v1/wishlists/${characterId}`);
  return wishlistData;
}

function queryWishlists(characterIds) {
  const requests = characterIds.maps((id) => ({
    url: "https://wowaudit.com/v1/wishlists/" + id,
    method: "get",
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json' 
      }
  }))
  const responses = UrlFetchApp.fetchAll(requests);
  return responses.map((response, index) => {
  try {
    return {
      id: characterIds[index],
      data: JSON.parse(response.getContentText()),
    };
  } catch (e) {
    console.error(`Failed to parse response for ID ${characterIds[index]}: ${e}`);
    return {
      id: characterIds[index],
      data: null,
      error: e.message,
    };
  }
});
}