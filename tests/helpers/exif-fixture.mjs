// Synthetic metadata for integration tests; never represents the source photo's EXIF.
export function withTestExif(jpeg) {
 const tiff=Buffer.alloc(2048);let cursor=200;
 tiff.write('II');tiff.writeUInt16LE(42,2);tiff.writeUInt32LE(8,4);
 const ascii=value=>Buffer.from(value+'\0');
 const rational=(...values)=>{const data=Buffer.alloc(values.length*8);values.forEach(([n,d],i)=>{data.writeUInt32LE(n,i*8);data.writeUInt32LE(d,i*8+4);});return data;};
 function ifd(offset,rows){tiff.writeUInt16LE(rows.length,offset);for(const [i,[tag,type,count,value]] of rows.entries()){const at=offset+2+i*12;tiff.writeUInt16LE(tag,at);tiff.writeUInt16LE(type,at+2);tiff.writeUInt32LE(count,at+4);if(Buffer.isBuffer(value)){if(value.length<=4)value.copy(tiff,at+8);else{tiff.writeUInt32LE(cursor,at+8);value.copy(tiff,cursor);cursor+=value.length;}}else if(type===3)tiff.writeUInt16LE(value,at+8);else tiff.writeUInt32LE(value,at+8);}tiff.writeUInt32LE(0,offset+2+rows.length*12);}
 const make=ascii('NIKON CORPORATION'),model=ascii('NIKON Z f'),lens=ascii('NIKKOR Z 40mm f/2'),serial=ascii('PRIVATE-TEST-SERIAL');
 ifd(8,[[0x010f,2,make.length,make],[0x0110,2,model.length,model],[0x8769,4,1,62],[0x8825,4,1,140]]);
 ifd(62,[[0x829a,5,1,rational([1,250])],[0x829d,5,1,rational([28,10])],[0x8827,3,1,200],[0x920a,5,1,rational([40,1])],[0xa431,2,serial.length,serial],[0xa434,2,lens.length,lens]]);
 ifd(140,[[1,2,2,ascii('N')],[2,5,3,rational([25,1],[0,1],[0,1])]]);
 const payload=Buffer.concat([Buffer.from('Exif\0\0'),tiff.subarray(0,cursor)]),segment=Buffer.alloc(4);segment.writeUInt16BE(0xffe1);segment.writeUInt16BE(payload.length+2,2);
 return Buffer.concat([jpeg.subarray(0,2),segment,payload,jpeg.subarray(2)]);
}
