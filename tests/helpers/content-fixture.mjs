import seed from '../../data/seed.json' with {type:'json'};
// Synthetic fixtures only. No content or media from a deployed website.
export default {
 ...structuredClone(seed),
 photos:[1,2,3].map(n=>({id:`fixture-${n}`,file:`fixtures/${n}.jpg`,thumbnail:'',title:`測試照片 ${n}`,en:'PHOTOGRAPHY',alt:`合成測試資料 ${n}`,source:'TEST FIXTURE',credit:'Test Creator',temporary:false,status:'published',exif:{},updatedAt:'2020-01-01T00:00:00.000Z'})),
 notes:[],
 friends:[{id:'fixture-friend',name:'Example',url:'https://example.com/',domain:'example.com',description:'合成測試友鏈。',label:'測試',status:'published'}]
};
