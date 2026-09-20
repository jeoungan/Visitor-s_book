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
export const bareArmStart=[88,88,88,88,88,72,88,86,84,85,77,79,72,84,87,85];
export const leftBareArmStart=[88,88,88,88,88,72,88,81,84,85,73,76,70,76,82,78];
export const LEFT_HAND_GRIPS=[[45,94],[45,93.5],[45,94],[45,93.5],[44,92.5],[45,92],[45,92],[47,92.5],[44,88],[44,88],[43.5,88],[44.5,88.5],[43,86],[43,86],[46,86.5],[45,86.5]];
export const PROP_GRIPS={10:[.5,18/128],11:[.5,18/128],12:[.5,38/128],13:[.5,96/128]};
