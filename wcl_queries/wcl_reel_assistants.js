// https://www.warcraftlogs.com/reports/GgfHC2thZWwv1N4D?pins=2%24Off%24%23244F4B%24expression%24target.resources.hpPercent+%3C%3D+25+AND+effectiveDamage+%3C+absorbedDamage+AND+target.id+%3D+228463&type=damage-done&fight=44&options=8192

const immuneBuffId = 460973;
const reelAssistantId = 232599; //228463 appears at fight start

let buffedAdds = {};

initializePinForFight = (fight) => {
        fight.allEventsByCategoryAndDisposition("aurascast","enemy")
        .filter( e => (e.type === "applybuff" || e.type === "removebuff") && e.ability.id === immuneBuffId && e.target.gameId === reelAssistantId)
        .forEach(e =>  {
            const add = e.target.instanceId;
            buffedAdds[add] = buffedAdds[add] || [];
            if (e.type === "applybuff") {
                buffedAdds[add].push({start: e.timestamp, end:null});
            } else {
                const lastWindow = buffedAdds[add][buffedAdds[add].length - 1];
                if (lastWindow && lastWindow.end === null) {
                    lastWindow.end = e.timestamp;
                }
            }
        }
        );

          Object.values(buffedAdds).forEach(add =>
    add.forEach(a => { if (a.end === null) a.end = Infinity; })
  );
};


pinMatchesFightEvent = (event, fight) => {
    if (!buffedAdds[event.target.instanceId]) return false;
    return buffedAdds[event.target.instanceId].some(a => event.timestamp > a.start && event.timestamp < a.end) && event.type === "damage";
}