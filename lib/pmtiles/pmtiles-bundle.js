// DEFLATE is a complex format; to read this code, you should probably check the RFC first:
// https://tools.ietf.org/html/rfc1951
// You may also wish to take a look at the guide I made about this program:
// https://gist.github.com/101arrowz/253f31eb5abc3d9275ab943003ffecad
// Some of the following code is similar to that of UZIP.js:
// https://github.com/photopea/UZIP.js
// However, the vast majority of the codebase has diverged from UZIP.js to increase performance and reduce bundle size.
// Sometimes 0 will appear where -1 would be more appropriate. This is because using a uint
// is better for memory in most engines (I *think*).

// aliases for shorter compressed code (most minifers don't do this)
var u8 = Uint8Array, u16 = Uint16Array, i32 = Int32Array;
// fixed length extra bits
var fleb = new u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, /* unused */ 0, 0, /* impossible */ 0]);
// fixed distance extra bits
var fdeb = new u8([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, /* unused */ 0, 0]);
// code length index map
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
// get base, reverse index map from extra bits
var freb = function (eb, start) {
    var b = new u16(31);
    for (var i = 0; i < 31; ++i) {
        b[i] = start += 1 << eb[i - 1];
    }
    // numbers here are at max 18 bits
    var r = new i32(b[30]);
    for (var i = 1; i < 30; ++i) {
        for (var j = b[i]; j < b[i + 1]; ++j) {
            r[j] = ((j - b[i]) << 5) | i;
        }
    }
    return { b: b, r: r };
};
var _a = freb(fleb, 2), fl = _a.b, revfl = _a.r;
// we can ignore the fact that the other numbers are wrong; they never happen anyway
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0), fd = _b.b;
// map of value to reverse (assuming 16 bits)
var rev = new u16(32768);
for (var i = 0; i < 32768; ++i) {
    // reverse table algorithm from SO
    var x$1 = ((i & 0xAAAA) >> 1) | ((i & 0x5555) << 1);
    x$1 = ((x$1 & 0xCCCC) >> 2) | ((x$1 & 0x3333) << 2);
    x$1 = ((x$1 & 0xF0F0) >> 4) | ((x$1 & 0x0F0F) << 4);
    rev[i] = (((x$1 & 0xFF00) >> 8) | ((x$1 & 0x00FF) << 8)) >> 1;
}
// create huffman tree from u8 "map": index -> code length for code index
// mb (max bits) must be at most 15
// TODO: optimize/split up?
var hMap = (function (cd, mb, r) {
    var s = cd.length;
    // index
    var i = 0;
    // u16 "map": index -> # of codes with bit length = index
    var l = new u16(mb);
    // length of cd must be 288 (total # of codes)
    for (; i < s; ++i) {
        if (cd[i])
            ++l[cd[i] - 1];
    }
    // u16 "map": index -> minimum code for bit length = index
    var le = new u16(mb);
    for (i = 1; i < mb; ++i) {
        le[i] = (le[i - 1] + l[i - 1]) << 1;
    }
    var co;
    if (r) {
        // u16 "map": index -> number of actual bits, symbol for code
        co = new u16(1 << mb);
        // bits to remove for reverser
        var rvb = 15 - mb;
        for (i = 0; i < s; ++i) {
            // ignore 0 lengths
            if (cd[i]) {
                // num encoding both symbol and bits read
                var sv = (i << 4) | cd[i];
                // free bits
                var r_1 = mb - cd[i];
                // start value
                var v = le[cd[i] - 1]++ << r_1;
                // m is end value
                for (var m = v | ((1 << r_1) - 1); v <= m; ++v) {
                    // every 16 bit value starting with the code yields the same result
                    co[rev[v] >> rvb] = sv;
                }
            }
        }
    }
    else {
        co = new u16(s);
        for (i = 0; i < s; ++i) {
            if (cd[i]) {
                co[i] = rev[le[cd[i] - 1]++] >> (15 - cd[i]);
            }
        }
    }
    return co;
});
// fixed length tree
var flt = new u8(288);
for (var i = 0; i < 144; ++i)
    flt[i] = 8;
for (var i = 144; i < 256; ++i)
    flt[i] = 9;
for (var i = 256; i < 280; ++i)
    flt[i] = 7;
for (var i = 280; i < 288; ++i)
    flt[i] = 8;
// fixed distance tree
var fdt = new u8(32);
for (var i = 0; i < 32; ++i)
    fdt[i] = 5;
// fixed length map
var flrm = /*#__PURE__*/ hMap(flt, 9, 1);
// fixed distance map
var fdrm = /*#__PURE__*/ hMap(fdt, 5, 1);
// find max of array
var max = function (a) {
    var m = a[0];
    for (var i = 1; i < a.length; ++i) {
        if (a[i] > m)
            m = a[i];
    }
    return m;
};
// read d, starting at bit p and mask with m
var bits = function (d, p, m) {
    var o = (p / 8) | 0;
    return ((d[o] | (d[o + 1] << 8)) >> (p & 7)) & m;
};
// read d, starting at bit p continuing for at least 16 bits
var bits16 = function (d, p) {
    var o = (p / 8) | 0;
    return ((d[o] | (d[o + 1] << 8) | (d[o + 2] << 16)) >> (p & 7));
};
// get end of byte
var shft = function (p) { return ((p + 7) / 8) | 0; };
// typed array slice - allows garbage collector to free original reference,
// while being more compatible than .slice
var slc = function (v, s, e) {
    if (e == null || e > v.length)
        e = v.length;
    // can't use .constructor in case user-supplied
    return new u8(v.subarray(s, e));
};
// error codes
var ec = [
    'unexpected EOF',
    'invalid block type',
    'invalid length/literal',
    'invalid distance',
    'stream finished',
    'no stream handler',
    ,
    'no callback',
    'invalid UTF-8 data',
    'extra field too long',
    'date not in range 1980-2099',
    'filename too long',
    'stream finishing',
    'invalid zip data'
    // determined by unknown compression method
];
var err = function (ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
        Error.captureStackTrace(e, err);
    if (!nt)
        throw e;
    return e;
};
// expands raw DEFLATE data
var inflt = function (dat, st, buf, dict) {
    // source length       dict length
    var sl = dat.length, dl = 0;
    if (!sl || st.f && !st.l)
        return buf || new u8(0);
    var noBuf = !buf;
    // have to estimate size
    var resize = noBuf || st.i != 2;
    // no state
    var noSt = st.i;
    // Assumes roughly 33% compression ratio average
    if (noBuf)
        buf = new u8(sl * 3);
    // ensure buffer can fit at least l elements
    var cbuf = function (l) {
        var bl = buf.length;
        // need to increase size to fit
        if (l > bl) {
            // Double or set to necessary, whichever is greater
            var nbuf = new u8(Math.max(bl * 2, l));
            nbuf.set(buf);
            buf = nbuf;
        }
    };
    //  last chunk         bitpos           bytes
    var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
    // total bits
    var tbts = sl * 8;
    do {
        if (!lm) {
            // BFINAL - this is only 1 when last chunk is next
            final = bits(dat, pos, 1);
            // type: 0 = no compression, 1 = fixed huffman, 2 = dynamic huffman
            var type = bits(dat, pos + 1, 3);
            pos += 3;
            if (!type) {
                // go to end of byte boundary
                var s = shft(pos) + 4, l = dat[s - 4] | (dat[s - 3] << 8), t = s + l;
                if (t > sl) {
                    if (noSt)
                        err(0);
                    break;
                }
                // ensure size
                if (resize)
                    cbuf(bt + l);
                // Copy over uncompressed data
                buf.set(dat.subarray(s, t), bt);
                // Get new bitpos, update byte count
                st.b = bt += l, st.p = pos = t * 8, st.f = final;
                continue;
            }
            else if (type == 1)
                lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
            else if (type == 2) {
                //  literal                            lengths
                var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
                var tl = hLit + bits(dat, pos + 5, 31) + 1;
                pos += 14;
                // length+distance tree
                var ldt = new u8(tl);
                // code length tree
                var clt = new u8(19);
                for (var i = 0; i < hcLen; ++i) {
                    // use index map to get real code
                    clt[clim[i]] = bits(dat, pos + i * 3, 7);
                }
                pos += hcLen * 3;
                // code lengths bits
                var clb = max(clt), clbmsk = (1 << clb) - 1;
                // code lengths map
                var clm = hMap(clt, clb, 1);
                for (var i = 0; i < tl;) {
                    var r = clm[bits(dat, pos, clbmsk)];
                    // bits read
                    pos += r & 15;
                    // symbol
                    var s = r >> 4;
                    // code length to copy
                    if (s < 16) {
                        ldt[i++] = s;
                    }
                    else {
                        //  copy   count
                        var c = 0, n = 0;
                        if (s == 16)
                            n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
                        else if (s == 17)
                            n = 3 + bits(dat, pos, 7), pos += 3;
                        else if (s == 18)
                            n = 11 + bits(dat, pos, 127), pos += 7;
                        while (n--)
                            ldt[i++] = c;
                    }
                }
                //    length tree                 distance tree
                var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
                // max length bits
                lbt = max(lt);
                // max dist bits
                dbt = max(dt);
                lm = hMap(lt, lbt, 1);
                dm = hMap(dt, dbt, 1);
            }
            else
                err(1);
            if (pos > tbts) {
                if (noSt)
                    err(0);
                break;
            }
        }
        // Make sure the buffer can hold this + the largest possible addition
        // Maximum chunk size (practically, theoretically infinite) is 2^17
        if (resize)
            cbuf(bt + 131072);
        var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
        var lpos = pos;
        for (;; lpos = pos) {
            // bits read, code
            var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
            pos += c & 15;
            if (pos > tbts) {
                if (noSt)
                    err(0);
                break;
            }
            if (!c)
                err(2);
            if (sym < 256)
                buf[bt++] = sym;
            else if (sym == 256) {
                lpos = pos, lm = null;
                break;
            }
            else {
                var add = sym - 254;
                // no extra bits needed if less
                if (sym > 264) {
                    // index
                    var i = sym - 257, b = fleb[i];
                    add = bits(dat, pos, (1 << b) - 1) + fl[i];
                    pos += b;
                }
                // dist
                var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
                if (!d)
                    err(3);
                pos += d & 15;
                var dt = fd[dsym];
                if (dsym > 3) {
                    var b = fdeb[dsym];
                    dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
                }
                if (pos > tbts) {
                    if (noSt)
                        err(0);
                    break;
                }
                if (resize)
                    cbuf(bt + 131072);
                var end = bt + add;
                if (bt < dt) {
                    var shift = dl - dt, dend = Math.min(dt, end);
                    if (shift + bt < 0)
                        err(3);
                    for (; bt < dend; ++bt)
                        buf[bt] = dict[shift + bt];
                }
                for (; bt < end; ++bt)
                    buf[bt] = buf[bt - dt];
            }
        }
        st.l = lm, st.p = lpos, st.b = bt, st.f = final;
        if (lm)
            final = 1, st.m = lbt, st.d = dm, st.n = dbt;
    } while (!final);
    // don't reallocate for streams or user buffers
    return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
// empty
var et = /*#__PURE__*/ new u8(0);
// gzip footer: -8 to -4 = CRC, -4 to -0 is length
// gzip start
var gzs = function (d) {
    if (d[0] != 31 || d[1] != 139 || d[2] != 8)
        err(6, 'invalid gzip data');
    var flg = d[3];
    var st = 10;
    if (flg & 4)
        st += (d[10] | d[11] << 8) + 2;
    for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d[st++])
        ;
    return st + (flg & 2);
};
// gzip length
var gzl = function (d) {
    var l = d.length;
    return (d[l - 4] | d[l - 3] << 8 | d[l - 2] << 16 | d[l - 1] << 24) >>> 0;
};
// zlib start
var zls = function (d, dict) {
    if ((d[0] & 15) != 8 || (d[0] >> 4) > 7 || ((d[0] << 8 | d[1]) % 31))
        err(6, 'invalid zlib data');
    if ((d[1] >> 5 & 1) == 1)
        err(6, 'invalid zlib data: ' + (d[1] & 32 ? 'need' : 'unexpected') + ' dictionary');
    return (d[1] >> 3 & 4) + 2;
};
/**
 * Expands DEFLATE data with no wrapper
 * @param data The data to decompress
 * @param opts The decompression options
 * @returns The decompressed version of the data
 */
function inflateSync(data, opts) {
    return inflt(data, { i: 2 }, opts, opts);
}
/**
 * Expands GZIP data
 * @param data The data to decompress
 * @param opts The decompression options
 * @returns The decompressed version of the data
 */
function gunzipSync(data, opts) {
    var st = gzs(data);
    if (st + 8 > data.length)
        err(6, 'invalid gzip data');
    return inflt(data.subarray(st, -8), { i: 2 }, new u8(gzl(data)), opts);
}
/**
 * Expands Zlib data
 * @param data The data to decompress
 * @param opts The decompression options
 * @returns The decompressed version of the data
 */
function unzlibSync(data, opts) {
    return inflt(data.subarray(zls(data), -4), { i: 2 }, opts, opts);
}
/**
 * Expands compressed GZIP, Zlib, or raw DEFLATE data, automatically detecting the format
 * @param data The data to decompress
 * @param opts The decompression options
 * @returns The decompressed version of the data
 */
function decompressSync(data, opts) {
    return (data[0] == 31 && data[1] == 139 && data[2] == 8)
        ? gunzipSync(data, opts)
        : ((data[0] & 15) != 8 || (data[0] >> 4) > 7 || ((data[0] << 8 | data[1]) % 31))
            ? inflateSync(data, opts)
            : unzlibSync(data, opts);
}
// text decoder
var td = typeof TextDecoder != 'undefined' && /*#__PURE__*/ new TextDecoder();
// text decoder stream
var tds = 0;
try {
    td.decode(et, { stream: true });
    tds = 1;
}
catch (e) { }

var z=Object.defineProperty;var b=Math.pow;var l=(i,e)=>z(i,"name",{value:e,configurable:true});var m=(i,e,t)=>new Promise((r,n)=>{var s=u=>{try{a(t.next(u));}catch(c){n(c);}},o=u=>{try{a(t.throw(u));}catch(c){n(c);}},a=u=>u.done?r(u.value):Promise.resolve(u.value).then(s,o);a((t=t.apply(i,e)).next());});var re=l((i,e)=>{let t=false,r="",n=L.GridLayer.extend({createTile:l((s,o)=>{let a=document.createElement("img"),u=new AbortController,c=u.signal;return a.cancel=()=>{u.abort();},t||(i.getHeader().then(d=>{d.tileType===1?console.error("Error: archive contains MVT vector tiles, but leafletRasterLayer is for displaying raster tiles. See https://github.com/protomaps/PMTiles/tree/main/js for details."):d.tileType===2?r="image/png":d.tileType===3?r="image/jpeg":d.tileType===4?r="image/webp":d.tileType===5&&(r="image/avif");}),t=true),i.getZxy(s.z,s.x,s.y,c).then(d=>{if(d){let h=new Blob([d.data],{type:r}),p=window.URL.createObjectURL(h);a.src=p,a.cancel=void 0,o(void 0,a);}}).catch(d=>{if(d.name!=="AbortError")throw d}),a},"createTile"),_removeTile:l(function(s){let o=this._tiles[s];o&&(o.el.cancel&&o.el.cancel(),o.el.width=0,o.el.height=0,o.el.deleted=true,L.DomUtil.remove(o.el),delete this._tiles[s],this.fire("tileunload",{tile:o.el,coords:this._keyToTileCoords(s)}));},"_removeTile")});return new n(e)},"leafletRasterLayer"),j=l(i=>(e,t)=>{if(t instanceof AbortController)return i(e,t);let r=new AbortController;return i(e,r).then(n=>t(void 0,n.data,n.cacheControl||"",n.expires||""),n=>t(n)).catch(n=>t(n)),{cancel:l(()=>r.abort(),"cancel")}},"v3compat"),T=class T{constructor(e){this.tilev4=l((e,t)=>m(this,null,function*(){if(e.type==="json"){let p=e.url.substr(10),y=this.tiles.get(p);if(y||(y=new x(p),this.tiles.set(p,y)),this.metadata)return {data:yield y.getTileJson(e.url)};let f=yield y.getHeader();return (f.minLon>=f.maxLon||f.minLat>=f.maxLat)&&console.error(`Bounds of PMTiles archive ${f.minLon},${f.minLat},${f.maxLon},${f.maxLat} are not valid.`),{data:{tiles:[`${e.url}/{z}/{x}/{y}`],minzoom:f.minZoom,maxzoom:f.maxZoom,bounds:[f.minLon,f.minLat,f.maxLon,f.maxLat]}}}let r=new RegExp(/pmtiles:\/\/(.+)\/(\d+)\/(\d+)\/(\d+)/),n=e.url.match(r);if(!n)throw new Error("Invalid PMTiles protocol URL");let s=n[1],o=this.tiles.get(s);o||(o=new x(s),this.tiles.set(s,o));let a=n[2],u=n[3],c=n[4],d=yield o.getHeader(),h=yield o==null?void 0:o.getZxy(+a,+u,+c,t.signal);if(h)return {data:new Uint8Array(h.data),cacheControl:h.cacheControl,expires:h.expires};if(d.tileType===1){if(this.errorOnMissingTile)throw new Error("Tile not found.");return {data:new Uint8Array}}return {data:null}}),"tilev4");this.tile=j(this.tilev4);this.tiles=new Map,this.metadata=(e==null?void 0:e.metadata)||false,this.errorOnMissingTile=(e==null?void 0:e.errorOnMissingTile)||false;}add(e){this.tiles.set(e.source.getKey(),e);}get(e){return this.tiles.get(e)}};l(T,"Protocol");var S=T;function w(i,e){return (e>>>0)*4294967296+(i>>>0)}l(w,"toNum");function F(i,e){let t=e.buf,r=t[e.pos++],n=(r&112)>>4;if(r<128||(r=t[e.pos++],n|=(r&127)<<3,r<128)||(r=t[e.pos++],n|=(r&127)<<10,r<128)||(r=t[e.pos++],n|=(r&127)<<17,r<128)||(r=t[e.pos++],n|=(r&127)<<24,r<128)||(r=t[e.pos++],n|=(r&1)<<31,r<128))return w(i,n);throw new Error("Expected varint not more than 10 bytes")}l(F,"readVarintRemainder");function v(i){let e=i.buf,t=e[i.pos++],r=t&127;return t<128||(t=e[i.pos++],r|=(t&127)<<7,t<128)||(t=e[i.pos++],r|=(t&127)<<14,t<128)||(t=e[i.pos++],r|=(t&127)<<21,t<128)?r:(t=e[i.pos],r|=(t&15)<<28,F(r,i))}l(v,"readVarint");function k(i,e,t,r){if(r===0){t===1&&(e[0]=i-1-e[0],e[1]=i-1-e[1]);let n=e[0];e[0]=e[1],e[1]=n;}}l(k,"rotate");function N(i,e){let t=b(2,i),r=e,n=e,s=e,o=[0,0],a=1;for(;a<t;)r=1&s/2,n=1&(s^r),k(a,o,r,n),o[0]+=a*r,o[1]+=a*n,s=s/4,a*=2;return [i,o[0],o[1]]}l(N,"idOnLevel");var q=[0,1,5,21,85,341,1365,5461,21845,87381,349525,1398101,5592405,22369621,89478485,357913941,1431655765,5726623061,22906492245,91625968981,366503875925,1466015503701,5864062014805,23456248059221,93824992236885,375299968947541,0x5555555555555];function G(i,e,t){if(i>26)throw new Error("Tile zoom level exceeds max safe number limit (26)");if(e>b(2,i)-1||t>b(2,i)-1)throw new Error("tile x/y outside zoom level bounds");let r=q[i],n=b(2,i),s=0,o=0,a=0,u=[e,t],c=n/2;for(;c>0;)s=(u[0]&c)>0?1:0,o=(u[1]&c)>0?1:0,a+=c*c*(3*s^o),k(c,u,s,o),c=c/2;return r+a}l(G,"zxyToTileId");function ie(i){let e=0;for(let r=0;r<27;r++){let n=(1<<r)*(1<<r);if(e+n>i)return N(r,i-e);e+=n;}throw new Error("Tile zoom level exceeds max safe number limit (26)")}l(ie,"tileIdToZxy");var J=(s=>(s[s.Unknown=0]="Unknown",s[s.None=1]="None",s[s.Gzip=2]="Gzip",s[s.Brotli=3]="Brotli",s[s.Zstd=4]="Zstd",s))(J||{});function D(i,e){return m(this,null,function*(){if(e===1||e===0)return i;if(e===2){if(typeof globalThis.DecompressionStream=="undefined")return decompressSync(new Uint8Array(i));let t=new Response(i).body;if(!t)throw new Error("Failed to read response stream");let r=t.pipeThrough(new globalThis.DecompressionStream("gzip"));return new Response(r).arrayBuffer()}throw new Error("Compression method not supported")})}l(D,"defaultDecompress");var O=(o=>(o[o.Unknown=0]="Unknown",o[o.Mvt=1]="Mvt",o[o.Png=2]="Png",o[o.Jpeg=3]="Jpeg",o[o.Webp=4]="Webp",o[o.Avif=5]="Avif",o))(O||{});function _(i){return i===1?".mvt":i===2?".png":i===3?".jpg":i===4?".webp":i===5?".avif":""}l(_,"tileTypeExt");var Y=127;function Q(i,e){let t=0,r=i.length-1;for(;t<=r;){let n=r+t>>1,s=e-i[n].tileId;if(s>0)t=n+1;else if(s<0)r=n-1;else return i[n]}return r>=0&&(i[r].runLength===0||e-i[r].tileId<i[r].runLength)?i[r]:null}l(Q,"findTile");var A=class A{constructor(e){this.file=e;}getKey(){return this.file.name}getBytes(e,t){return m(this,null,function*(){return {data:yield this.file.slice(e,e+t).arrayBuffer()}})}};l(A,"FileSource");var V=A,U=class U{constructor(e,t=new Headers){this.url=e,this.customHeaders=t,this.mustReload=false;let r="";"navigator"in globalThis&&(r=globalThis.navigator.userAgent||"");let n=r.indexOf("Windows")>-1,s=/Chrome|Chromium|Edg|OPR|Brave/.test(r);this.chromeWindowsNoCache=false,n&&s&&(this.chromeWindowsNoCache=true);}getKey(){return this.url}setHeaders(e){this.customHeaders=e;}getBytes(e,t,r,n){return m(this,null,function*(){let s,o;r?o=r:(s=new AbortController,o=s.signal);let a=new Headers(this.customHeaders);a.set("range",`bytes=${e}-${e+t-1}`);let u;this.mustReload?u="reload":this.chromeWindowsNoCache&&(u="no-store");let c=yield fetch(this.url,{signal:o,cache:u,headers:a});if(e===0&&c.status===416){let y=c.headers.get("Content-Range");if(!y||!y.startsWith("bytes */"))throw new Error("Missing content-length on 416 response");let f=+y.substr(8);c=yield fetch(this.url,{signal:o,cache:"reload",headers:{range:`bytes=0-${f-1}`}});}let d=c.headers.get("Etag");if(d!=null&&d.startsWith("W/")&&(d=null),c.status===416||n&&d&&d!==n)throw this.mustReload=true,new E(`Server returned non-matching ETag ${n} after one retry. Check browser extensions and servers for issues that may affect correct ETag headers.`);if(c.status>=300)throw new Error(`Bad response code: ${c.status}`);let h=c.headers.get("Content-Length");if(c.status===200&&(!h||+h>t))throw s&&s.abort(),new Error("Server returned no content-length header or content-length exceeding request. Check that your storage backend supports HTTP Byte Serving.");return {data:yield c.arrayBuffer(),etag:d||void 0,cacheControl:c.headers.get("Cache-Control")||void 0,expires:c.headers.get("Expires")||void 0}})}};l(U,"FetchSource");var C=U;function g(i,e){let t=i.getUint32(e+4,true),r=i.getUint32(e+0,true);return t*b(2,32)+r}l(g,"getUint64");function X(i,e){let t=new DataView(i),r=t.getUint8(7);if(r>3)throw new Error(`Archive is spec version ${r} but this library supports up to spec version 3`);return {specVersion:r,rootDirectoryOffset:g(t,8),rootDirectoryLength:g(t,16),jsonMetadataOffset:g(t,24),jsonMetadataLength:g(t,32),leafDirectoryOffset:g(t,40),leafDirectoryLength:g(t,48),tileDataOffset:g(t,56),tileDataLength:g(t,64),numAddressedTiles:g(t,72),numTileEntries:g(t,80),numTileContents:g(t,88),clustered:t.getUint8(96)===1,internalCompression:t.getUint8(97),tileCompression:t.getUint8(98),tileType:t.getUint8(99),minZoom:t.getUint8(100),maxZoom:t.getUint8(101),minLon:t.getInt32(102,true)/1e7,minLat:t.getInt32(106,true)/1e7,maxLon:t.getInt32(110,true)/1e7,maxLat:t.getInt32(114,true)/1e7,centerZoom:t.getUint8(118),centerLon:t.getInt32(119,true)/1e7,centerLat:t.getInt32(123,true)/1e7,etag:e}}l(X,"bytesToHeader");function Z(i){let e={buf:new Uint8Array(i),pos:0},t=v(e),r=[],n=0;for(let s=0;s<t;s++){let o=v(e);r.push({tileId:n+o,offset:0,length:0,runLength:1}),n+=o;}for(let s=0;s<t;s++)r[s].runLength=v(e);for(let s=0;s<t;s++)r[s].length=v(e);for(let s=0;s<t;s++){let o=v(e);o===0&&s>0?r[s].offset=r[s-1].offset+r[s-1].length:r[s].offset=o-1;}return r}l(Z,"deserializeIndex");var R=class R extends Error{};l(R,"EtagMismatch");var E=R;function K(i,e){return m(this,null,function*(){let t=yield i.getBytes(0,16384);if(new DataView(t.data).getUint16(0,true)!==19792)throw new Error("Wrong magic number for PMTiles archive");let n=t.data.slice(0,Y),s=X(n,t.etag),o=t.data.slice(s.rootDirectoryOffset,s.rootDirectoryOffset+s.rootDirectoryLength),a=`${i.getKey()}|${s.etag||""}|${s.rootDirectoryOffset}|${s.rootDirectoryLength}`,u=Z(yield e(o,s.internalCompression));return [s,[a,u.length,u]]})}l(K,"getHeaderAndRoot");function I(i,e,t,r,n){return m(this,null,function*(){let s=yield i.getBytes(t,r,void 0,n.etag),o=yield e(s.data,n.internalCompression),a=Z(o);if(a.length===0)throw new Error("Empty directory is invalid");return a})}l(I,"getDirectory");var H=class H{constructor(e=100,t=true,r=D){this.cache=new Map,this.maxCacheEntries=e,this.counter=1,this.decompress=r;}getHeader(e){return m(this,null,function*(){let t=e.getKey(),r=this.cache.get(t);if(r)return r.lastUsed=this.counter++,r.data;let n=yield K(e,this.decompress);return n[1]&&this.cache.set(n[1][0],{lastUsed:this.counter++,data:n[1][2]}),this.cache.set(t,{lastUsed:this.counter++,data:n[0]}),this.prune(),n[0]})}getDirectory(e,t,r,n){return m(this,null,function*(){let s=`${e.getKey()}|${n.etag||""}|${t}|${r}`,o=this.cache.get(s);if(o)return o.lastUsed=this.counter++,o.data;let a=yield I(e,this.decompress,t,r,n);return this.cache.set(s,{lastUsed:this.counter++,data:a}),this.prune(),a})}prune(){if(this.cache.size>this.maxCacheEntries){let e=1/0,t;this.cache.forEach((r,n)=>{r.lastUsed<e&&(e=r.lastUsed,t=n);}),t&&this.cache.delete(t);}}invalidate(e){return m(this,null,function*(){this.cache.delete(e.getKey());})}};l(H,"ResolvedValueCache");var $=H,M=class M{constructor(e=100,t=true,r=D){this.cache=new Map,this.invalidations=new Map,this.maxCacheEntries=e,this.counter=1,this.decompress=r;}getHeader(e){return m(this,null,function*(){let t=e.getKey(),r=this.cache.get(t);if(r)return r.lastUsed=this.counter++,yield r.data;let n=new Promise((s,o)=>{K(e,this.decompress).then(a=>{a[1]&&this.cache.set(a[1][0],{lastUsed:this.counter++,data:Promise.resolve(a[1][2])}),s(a[0]),this.prune();}).catch(a=>{o(a);});});return this.cache.set(t,{lastUsed:this.counter++,data:n}),n})}getDirectory(e,t,r,n){return m(this,null,function*(){let s=`${e.getKey()}|${n.etag||""}|${t}|${r}`,o=this.cache.get(s);if(o)return o.lastUsed=this.counter++,yield o.data;let a=new Promise((u,c)=>{I(e,this.decompress,t,r,n).then(d=>{u(d),this.prune();}).catch(d=>{c(d);});});return this.cache.set(s,{lastUsed:this.counter++,data:a}),a})}prune(){if(this.cache.size>=this.maxCacheEntries){let e=1/0,t;this.cache.forEach((r,n)=>{r.lastUsed<e&&(e=r.lastUsed,t=n);}),t&&this.cache.delete(t);}}invalidate(e){return m(this,null,function*(){let t=e.getKey();if(this.invalidations.get(t))return yield this.invalidations.get(t);this.cache.delete(e.getKey());let r=new Promise((n,s)=>{this.getHeader(e).then(o=>{n(),this.invalidations.delete(t);}).catch(o=>{s(o);});});this.invalidations.set(t,r);})}};l(M,"SharedPromiseCache");var P=M,B=class B{constructor(e,t,r){typeof e=="string"?this.source=new C(e):this.source=e,r?this.decompress=r:this.decompress=D,t?this.cache=t:this.cache=new P;}getHeader(){return m(this,null,function*(){return yield this.cache.getHeader(this.source)})}getZxyAttempt(e,t,r,n){return m(this,null,function*(){let s=G(e,t,r),o=yield this.cache.getHeader(this.source);if(e<o.minZoom||e>o.maxZoom)return;let a=o.rootDirectoryOffset,u=o.rootDirectoryLength;for(let c=0;c<=3;c++){let d=yield this.cache.getDirectory(this.source,a,u,o),h=Q(d,s);if(h){if(h.runLength>0){let p=yield this.source.getBytes(o.tileDataOffset+h.offset,h.length,n,o.etag);return {data:yield this.decompress(p.data,o.tileCompression),cacheControl:p.cacheControl,expires:p.expires}}a=o.leafDirectoryOffset+h.offset,u=h.length;}else return}throw new Error("Maximum directory depth exceeded")})}getZxy(e,t,r,n){return m(this,null,function*(){try{return yield this.getZxyAttempt(e,t,r,n)}catch(s){if(s instanceof E)return this.cache.invalidate(this.source),yield this.getZxyAttempt(e,t,r,n);throw s}})}getMetadataAttempt(){return m(this,null,function*(){let e=yield this.cache.getHeader(this.source),t=yield this.source.getBytes(e.jsonMetadataOffset,e.jsonMetadataLength,void 0,e.etag),r=yield this.decompress(t.data,e.internalCompression),n=new TextDecoder("utf-8");return JSON.parse(n.decode(r))})}getMetadata(){return m(this,null,function*(){try{return yield this.getMetadataAttempt()}catch(e){if(e instanceof E)return this.cache.invalidate(this.source),yield this.getMetadataAttempt();throw e}})}getTileJson(e){return m(this,null,function*(){let t=yield this.getHeader(),r=yield this.getMetadata(),n=_(t.tileType);return {tilejson:"3.0.0",scheme:"xyz",tiles:[`${e}/{z}/{x}/{y}${n}`],vector_layers:r.vector_layers,attribution:r.attribution,description:r.description,name:r.name,version:r.version,bounds:[t.minLon,t.minLat,t.maxLon,t.maxLat],center:[t.centerLon,t.centerLat,t.centerZoom],minzoom:t.minZoom,maxzoom:t.maxZoom}})}};l(B,"PMTiles");var x=B;

export { J as Compression, E as EtagMismatch, C as FetchSource, V as FileSource, x as PMTiles, S as Protocol, $ as ResolvedValueCache, P as SharedPromiseCache, O as TileType, X as bytesToHeader, Q as findTile, g as getUint64, re as leafletRasterLayer, v as readVarint, ie as tileIdToZxy, _ as tileTypeExt, G as zxyToTileId };
