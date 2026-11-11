export const vertexShader=`
attribute vec2 aPosition;
varying vec2 vUV;
uniform float uTopDown;
void main(){vec2 uv=aPosition*.5+.5;vUV=vec2(uv.x,mix(uv.y,1.-uv.y,uTopDown));gl_Position=vec4(aPosition,0.,1.);}
`;
export const blurShader=`
precision highp float;
varying vec2 vUV;
uniform sampler2D uSource;
uniform vec2 uStep;
void main(){
 vec4 c=texture2D(uSource,vUV)*.227027027;
 c+=(texture2D(uSource,vUV+uStep)+texture2D(uSource,vUV-uStep))*.194594595;
 c+=(texture2D(uSource,vUV+uStep*2.)+texture2D(uSource,vUV-uStep*2.))*.121621622;
 c+=(texture2D(uSource,vUV+uStep*3.)+texture2D(uSource,vUV-uStep*3.))*.054054054;
 c+=(texture2D(uSource,vUV+uStep*4.)+texture2D(uSource,vUV-uStep*4.))*.016216216;
 gl_FragColor=c;
}
`;
export const refractionShader=`
precision highp float;
varying vec2 vUV;
uniform sampler2D uSource;
uniform sampler2D uScene;
uniform vec3 uButton;
uniform vec2 uSize;
uniform vec4 uMapping;
uniform float uRadius,uStrength,uDispersion,uTint,uEdgeShade,uEdgeWarp,uButtonWarp,uBottomReflection,uReflectionDepth;
// Bottom-rounded body with concave quadratic shoulders at the display edge.
// CSS clips the exact shared SVG path; this distance guides the optical edge normal.
float distanceToGlass(vec2 p){
 vec2 pixel=p+uSize*.5;
 float side=min(pixel.x,uSize.x-pixel.x);
 if(pixel.y<12.){
  float y=clamp(pixel.y,.01,12.);
  float edge=24.*sqrt(y/12.)-y;
  float slope=1./sqrt(y/12.)-1.;
  return (edge-side)/sqrt(1.+slope*slope);
 }
 vec2 q=vec2(abs(p.x)-(uSize.x*.5-12.-uRadius),pixel.y-(uSize.y-uRadius));
 return length(max(q,0.))+min(max(q.x,q.y),0.)-uRadius;
}
vec2 mapped(vec2 p){return clamp(uMapping.xy+(p/uSize+.5)*uMapping.zw,vec2(.0005),vec2(.9995));}
void main(){
 // A second circular lens refracts the dock beneath its crisp playback icon.
 vec2 surfaceP=(vUV-.5)*uSize;
 vec2 fromButton=surfaceP-uButton.xy;
 float buttonRadius=max(uButton.z,1.);
 float buttonDistance=length(fromButton),radial=buttonDistance/buttonRadius;
 float buttonCover=(1.-smoothstep(1.-max(.02,1./buttonRadius),1.,radial))*step(1.,uButton.z);
 float radialBand=smoothstep(.45,.98,radial);
 float buttonBend=pow(radialBand,1.7)*buttonRadius*.38*uButtonWarp*buttonCover;
 vec2 radialNormal=fromButton/max(buttonDistance,.001);
 vec2 p=surfaceP-radialNormal*buttonBend-fromButton*.025*uButtonWarp*buttonCover;
 float sd=distanceToGlass(p);
 // Exact shape antialiasing is supplied by the shared CSS path clip.
 float alpha=1.;
 float inside=max(0.,-sd),band=min(uRadius*1.6,min(uSize.x,uSize.y)*.25);
 float edge=clamp(1.-inside/max(band,1.),0.,1.);
 vec2 n=vec2(distanceToGlass(p+vec2(.5,0.))-distanceToGlass(p-vec2(.5,0.)),distanceToGlass(p+vec2(0.,.5))-distanceToGlass(p-vec2(0.,.5)));
 n/=max(length(n),.00001);
 float bend=pow(edge,1.7)*uEdgeWarp*min(uSize.x,uSize.y)*.18;
 vec2 refracted=p-n*bend-p*.018*uStrength;
 vec2 chroma=n*(uDispersion*6.*pow(edge,3.));
 vec3 c=vec3(texture2D(uSource,mapped(refracted+chroma)).r,texture2D(uSource,mapped(refracted)).g,texture2D(uSource,mapped(refracted-chroma)).b);
 float brightness=dot(c,vec3(.2126,.7152,.0722));
 float tint=clamp(uTint*(1.+.35*smoothstep(.45,.95,brightness)),0.,.8);
 c=mix(c,vec3(.028,.034,.045),tint);
 float light=max(0.,dot(n,normalize(vec2(-.65,-.75))));
 float rim=exp(-inside*1.8)*(.08+.42*pow(light,4.));
 float reflection=pow(edge,5.)*(.015+.045*light);
 c=mix(c,vec3(.94,.97,1.),rim)+reflection;
 // A restrained black falloff follows the lens contour, fading into clear glass.
 c*=1.-uEdgeShade*.4*exp(-inside/18.);
 // Mirror adjacent desktop pixels into the lower bevel (screen-space approximation).
 float lowerFacing=smoothstep(.05,.7,n.y)*smoothstep(0.,uSize.y*.32,surfaceP.y);
 float reflectionBand=mix(2.,min(16.,uRadius*.4),uReflectionDepth);
 vec2 reflectedP=p+n*(2.*inside+mix(10.,34.,uReflectionDepth));
 vec3 reflected=texture2D(uScene,mapped(reflectedP)).rgb;
 reflected=mix(reflected,vec3(.028,.034,.045),uTint*.35);
 float reflectedWeight=uBottomReflection*.2*exp(-inside/reflectionBand)*lowerFacing*(1.+.5*abs(n.x));
 c=mix(c,reflected,clamp(reflectedWeight,0.,.28));
 // A faint circular shade defines thickness without a bright rim arc.
 c*=1.-buttonCover*uButtonWarp*(.012+.018*pow(clamp(radial,0.,1.),6.));
 gl_FragColor=vec4(clamp(c,0.,1.)*alpha,alpha);
}
`;
