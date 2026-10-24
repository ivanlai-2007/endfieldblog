export function swipeDirection({dx,dy,elapsed,zoomed}){
 if(zoomed||Math.abs(dx)<50||Math.abs(dx)<=Math.abs(dy)*1.4||elapsed>=1000)return 0;
 return dx<0?1:-1;
}
