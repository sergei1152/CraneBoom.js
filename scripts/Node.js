var ForceLine=require('./ForceLine'); //node deligates forceline

var Node = fabric.util.createClass(fabric.Circle, {
    type: 'node',

    initialize: function(options) {
        if (!options) {
            options = {};
        }

        this.callSuper('initialize', options);

        //settings default values of the most important properties
        this.set({
            showCoords: false,
            left: options.left || -100,
            top: options.top || -100,
            strokeWidth: options.strokeWidth || 5,
            radius: options.radius || 12,
            fill: options.fill || '#FFFFFF',
            stroke: options.stroke || '#666',
            selectable: options.selectable || true,
            hasControls: false,
            hasBorders: false,
            label: options.label || '',
            maximum_shear_stress: null,
            support: options.support || false, //if the node is a support (and thus is a floor beam as well)
            floor_beam: options.floor_beam || false, //if the node is a floor beam
            external_force: [0,0], //the reaction forces acting on the floor beam
            connected_members: [] //the members that are connected to the floor beam
        });
    },
    
    toObject: function() {
        return {
            support: this.get('support'),
            floor_beam: this.get('floor_beam'),
            left: this.get('left'),
            top: this.get('top'),
        };
    },

    _render: function(ctx) {
        this.callSuper('_render', ctx);

        ctx.font = '15px Arial';
        ctx.fillStyle = 'hsla(87, 100%, 24%, 1)'; //color of the font
        if (this.showCoords) {
            // ctx.fillRect(-10, yOff, 150, 22); //will show a white rectangle background around the coordinates of the node
            ctx.fillText('('+Math.round(this.left*100)/100+', ' +Math.round(this.top*100)/100+')', 12,18);
        }
        else{
            ctx.fillText(this.label,12,18);
        }
    }
});

//for the import, takes in a json singleton representing a node and applies it to the current node object
Node.prototype.copyProp=function(nodeObj) {
    this.top = nodeObj.top;
    this.left = nodeObj.left;
    this.support = nodeObj.support;
    this.floor_beam = nodeObj.floor_beam;
    if (this.floor_beam) {
        this.lockMovementY = true;
    } else {
        this.lockMovementY = false;
    }
    if (this.support) {
        this.stroke = '#F41313';
        this.lockMovementX=true;
    } else if (this.floor_beam) {
        this.stroke = '#000000';
        this.lockMovementX=false;
    } //else default
};

module.exports=Node;

var E=require('./EntityController'); //since the entity controller is only required for the prototypes

//Moves the connected members of the node to its position
Node.prototype.moveMembers = function(canvas) {
    for (var i = 0; i < this.connected_members.length; i++) {
        if (this.connected_members[i].start_node == this) { //if the start of the member is connected to the this
            this.connected_members[i].set({
                x1: this.left,
                y1: this.top
            });
        } else if (this.connected_members[i].end_node == this) { //if the end of the member is connected to the this
            this.connected_members[i].set({
                x2: this.left,
                y2: this.top
            });
        }
        //Re-adding the members to avoing weird glitchiness (if canvas object available)
        if(canvas){
            canvas.remove(this.connected_members[i]);
            canvas.add(this.connected_members[i]);
            canvas.sendToBack(this.connected_members[i]); //sending the connected members to the back of the canvas
        }
    }
};
Node.prototype.setShearStress=function(stress){
    this.maximum_shear_stress=stress || 0;
    this.label=stress.toFixed(1)+'MPa';
    var percentMax=stress*100/E.node_maximum_shear_stress;
    if(percentMax>100){ //if the force exceeded maximum tensile force
        this.stroke='hsla(65, 100%, 60%, 1)';
    }
    else{
        this.stroke='hsla(360, '+(percentMax*0.8+20)+'%,50%, 1)';
    }
}
//set the reaction force of the node
Node.prototype.setForce=function(x,y,canvas){
    this.external_force[0]=x || 0;
    this.external_force[1]=y || 0;

    roundedX=Math.round(x*100)/100;
    roundedY=Math.round(y*100)/100;

    if(this.forceLineX && this.forceLineY){ //if a force line already exists
        this.forceLineX.set({
            x1: this.left,
            y1: this.top,
            label: Math.abs(roundedX)+'N',
            x2: this.left+roundedX*10,
            y2: this.top
        });
        this.forceLineY.set({
            x1: this.left,
            y1: this.top,
            label: Math.abs(roundedY)+'N',
            x2: this.left,
            y2: this.top-30*roundedY
        }); 
    }
    else { //if the forceline doesnt yet exist
        this.forceLineX=new ForceLine({
            x1: this.left,
            y1: this.top,
            label: Math.abs(roundedX)+'N',
            x2: this.left+roundedX*10,
            y2: this.top
            }); 
        this.forceLineY=new ForceLine({
            x1: this.left,
            y1: this.top,
            label: Math.abs(roundedY)+'N',
            x2: this.left,
            y2: this.top-30*roundedY
            }); 
        canvas.add(this.forceLineX);
        canvas.add(this.forceLineY);
    }
};