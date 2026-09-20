const skirts=new Set([8,9,10,11,12,13,15]);
// Lengthen the lower body while keeping shoe size and the foot anchor unchanged.
// A skirt's extension starts below its fitted bodice so its waist stays intact.
export function bodyProportions(outfit){
 const split=skirts.has(outfit)?104:90,ankle=118,extension=9;
 return{split,ankle,extension,scale:1+extension/(ankle-split)};
}
export function proportionY(y,outfit){
 const {split,ankle,extension,scale}=bodyProportions(outfit);
 return y<=split?y-extension:y<ankle?split-extension+(y-split)*scale:y;
}
export const ARM_RIGS=[
 {elbow:[82,74],polygon:[[79,72],[87,72],[89,89],[86,97],[80,97],[78,92],[79,82]]},
 {elbow:[82,74],polygon:[[79,72],[88,72],[90,88],[87,97],[80,97],[78,92],[79,82]]},
 {elbow:[82,74],polygon:[[79,72],[88,72],[90,89],[87,97],[81,97],[79,92],[79,82]]},
 {elbow:[82,74],polygon:[[79,72],[87,72],[89,88],[86,97],[80,97],[78,92],[79,83]]},
 {elbow:[82,74],polygon:[[79,72],[88,72],[90,89],[87,97],[80,97],[79,91],[79,82]]},
 {elbow:[82,75],polygon:[[79,73],[88,73],[89,88],[87,97],[80,97],[79,92],[79,81]]},
 {elbow:[82,74],polygon:[[79,72],[88,72],[90,88],[87,97],[80,97],[79,92],[79,82]]},
 {elbow:[83,77],polygon:[[79,76],[89,76],[89,87],[87,97],[80,97],[78,92],[79,82]]},
 {elbow:[82,72],polygon:[[79,70],[87,70],[89,84],[87,92],[79,92],[79,85]]},
 {elbow:[83,73],polygon:[[79,71],[88,71],[90,84],[88,93],[80,93],[79,85]]},
 {elbow:[80,74],polygon:[[77,72],[86,72],[87,79],[89,88],[86,92],[82,91],[80,85],[79,81],[77,77]]},
 {elbow:[80,75],polygon:[[78,74],[86,74],[87,81],[88,90],[85,93],[81,91],[80,86],[79,82],[78,78]]},
 {elbow:[80,71],polygon:[[76,69],[84,69],[87,77],[89,85],[87,92],[82,91],[82,86],[79,81],[78,76]]},
 {elbow:[82,74],polygon:[[79,73],[87,73],[89,81],[89,88],[85,92],[82,89],[81,84],[79,79]]},
 {elbow:[83,73],polygon:[[79,71],[87,71],[88,82],[87,90],[84,93],[79,92],[79,85]]},
 {elbow:[83,73],polygon:[[80,71],[87,71],[89,81],[88,87],[85,91],[80,90],[79,84],[80,78]]}
];
const shoulders=[[78,55],[78,55],[78,55],[78,55],[78,55],[79,55],[78,55],[79,55],[78,51],[79,51],[79,54],[78,54],[78,53],[79,53],[79,53],[80,54]];
const wrists=[[83,89],[84,89],[84,89],[83,89],[84,89],[84,90],[84,89],[84,90],[83,85],[84,86],[84,86],[84,87],[84,86],[85,86],[83,87],[84,85]];
export const bareArmStart=[88,88,88,88,88,72,88,86,84,85,77,79,72,84,87,85];
export const leftBareArmStart=[88,88,88,88,88,72,88,81,84,85,73,76,70,76,82,78];
export const LEFT_HAND_GRIPS=[[45,94],[45,93.5],[45,94],[45,93.5],[44,92.5],[45,92],[45,92],[47,92.5],[44,88],[44,88],[43.5,88],[44.5,88.5],[43,86],[43,86],[46,86.5],[45,86.5]];
export const PROP_GRIPS={10:[.5,18/128],11:[.5,18/128],12:[.5,38/128],13:[.5,96/128]};
ARM_RIGS.forEach((rig,i)=>{
 const [sx,sy]=shoulders[i],[ex,ey]=rig.elbow;
 rig.shoulder=[sx,sy];
 rig.wrist=wrists[i];
 // These masks follow the outside sleeve seam and overlap at the elbow.
 rig.upper=[[sx-3,sy-3],[sx+4,sy-2],[sx+8,sy+6],[ex+5,ey+1],[ex-4,ey+1],[ex-4,ey-6],[sx-2,sy+6]];
});
export function wavingPose(time){
 // Lift the elbow once into a comfortable pose; the small wave comes from
 // the forearm, rather than a large shoulder rotation or a crushed elbow.
 return{upper:-.82,forearm:-1.98+Math.sin(time*5)*.075,wrist:Math.sin(time*5+.4)*.09};
}
export function walkingPose(outfit,gait){
 const cut=skirts.has(outfit)?112:92,phase=Math.sin(gait),height=128-cut;
 return{cut,bob:Math.abs(phase)*.7,legs:[phase,-phase].map(stride=>({scaleY:1-Math.max(0,stride)*(skirts.has(outfit)?1.6:3)/height,shear:stride*(skirts.has(outfit)?.035:.045)}))};
}
