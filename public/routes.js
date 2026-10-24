export const itemPath=(kind,id)=>`/${kind}/${encodeURIComponent(id)}`;
export function parseRoute(location){
 const match=location.pathname.match(/^\/(photos|notes)\/([^/]+)\/?$/);
 const parts=match?[match[1],match[2]]:location.hash.slice(1).split('/');
 let id;try{id=parts[1]?decodeURIComponent(parts[1]):undefined;}catch{}
 return {screen:parts[0]||'home',id};
}
