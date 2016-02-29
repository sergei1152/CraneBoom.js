//Performs the cost and force calculation of the truss
var E=require('./EntityController');
var Grid=require('./Grid');

function calculateDesignWeight(){
	var weight=0; //in g
	var weightPerNode=Math.PI*Math.pow(E.node_diameter/2,2)*E.crane_depth*E.node_density;
	var weightPerMemberLength=E.member_width*E.member_thickness*E.member_density; //g per cm
	var missingWeightPerMember=2*Math.PI*Math.pow(E.node_diameter/2,2)*E.member_thickness; //this is the negative weight of the 2 holes in each member

	for(var i=0;i<E.nodes.length;i++){
		weight+=weightPerNode;
	}
	for(var j=0;j<E.members.length;j++){
		var length=E.members[j].calcLength()/Grid.px_per_cm; //length of member in cm
		weight+=weightPerMemberLength*length-missingWeightPerMember;
	}
	return weight;
}
//Calculating the support reactions at the 2 support nodes using moments
function calculateSupportReactions(){
	//calculate support reactions, and otherwise 0 if the car is completely out of the bridge and not touching the supports
	E.supportA.setForce(Math.abs(E.crane_length/E.crane_height*E.loadedPin.external_force[1]),Math.abs(E.loadedPin.external_force[1]));
	E.supportB.setForce(-1*E.supportA.external_force[0],0);
}

//Creates a matrix of 2N-3 equations based on the method of joints, and solves it
function methodOfJoints(){
	var force_matrix=[]; //each row will represent an Fx and Fy equation for each node
	var solution=[]; //this will represent the external forces in the x and y direction acting on the node

	for(var i=0;i<E.nodes.length;i++){ //iterate through all of the nodes that exist
		var rowX=[]; //will represent the Fx equation for the node
		var rowY=[]; //will represent the Fy equation for the node
		solution.push(-E.nodes[i].external_force[0]); //the external forces in the x direction of the node
		solution.push(-E.nodes[i].external_force[1]); //the external forces in the y direction o fthe noe
		
		for(var j=0;j<E.members.length;j++){ //iterate through all of the members that exist
			E.members[j].calcLength();
			E.members[j].calcUnitVector();

			var connected=false; //check if the member is connected to the node
			for(var k=0;k<E.nodes[i].connected_members.length;k++){ 
				if(E.members[j]===E.nodes[i].connected_members[k]){ //if the member is connected to the node
					if(E.nodes[i].connected_members[k].x1===E.nodes[i].left && E.nodes[i].connected_members[k].y1===E.nodes[i].top){ //if the start of the member is connected to the node
						rowX.push(-E.nodes[i].connected_members[k].unit_vector[0]);
						rowY.push(-E.nodes[i].connected_members[k].unit_vector[1]);
					}
					else{ //if the end of the member is at the node, flip the direction so all forces are tensile
						rowX.push(E.nodes[i].connected_members[k].unit_vector[0]);
						rowY.push(E.nodes[i].connected_members[k].unit_vector[1]);
					}
					connected=true;
				}

			}
			if(!connected){ //if the member is not connected to the node, then its not part of its Force equations
				rowX.push(0);
				rowY.push(0);
			}
		}
		force_matrix.push(rowX);
		force_matrix.push(rowY);
	}

	//eliminating last 3 equation since we have 2N equations and have 2N-3 members, thus we have 3 extra equations 
	force_matrix.pop();
	force_matrix.pop();
	force_matrix.pop();
	solution.pop();
	solution.pop();
	solution.pop();

	var forces=numeric.solve(force_matrix, solution, false); //solving for the forces

	E.designPass=true; //for checking whether a design meets the criteria
	
	//applying the force value to the specified member, as well as checking if its under the constraints
	for(i=0;i<E.members.length;i++){
		E.members[i].setForce(forces[i],E);
		// if(forces[i]>0 && forces[i]>E.max_tensile){
		// 	E.designPass=false;
		// }
		// else if(forces[i]<0 && Math.abs(forces[i])>E.max_compressive){
		// 	E.designPass=false;
		// }
	}
}

function calculateRuptureAndBucklingStress(){
	var minimumArea=(E.member_width*E.member_thickness-E.node_diameter*E.member_thickness)*100;//to convert cm^2 to mm2
	var maximumArea=E.member_width*E.member_thickness*100;
	var momentOfAreaMember=E.member_width*Math.pow(E.member_thickness,3)*10000/12; //we multiply by 10000 to convert cm4 to mm4
	var pi_squared=Math.PI*Math.PI;

	for(i=0;i<E.members.length;i++){
		if(E.members[i].force===0){
			E.members[i].stress=0;
		}
		else if(E.members[i].force>0){ //if we have a tensile force (make sure theres no rupture)
			E.members[i].stress=E.members[i].force/minimumArea;
			if(E.members[i].stress>E.max_tensile_stress){
				E.members[i].rupture_failure=true;
				console.log('member '+i+' ruptured');
			}
		}
		else if(E.members[i].force<0){ //under compressive stress, make sure there no buckling
			E.members[i].stress=E.members[i].force/maximumArea;
			E.members[i].critical_load=pi_squared*E.member_modulus_elasticity*momentOfAreaMember/Math.pow((E.members[i].member_length*10/Grid.px_per_cm),2);

			if(Math.abs(E.members[i].force)>E.members[i].critical_load){
				E.members[i].buckling_failure=true;
				console.log('member '+i+' buckled');
			}
			if(Math.abs(E.members[i].stress)>E.max_tensile_stress){
				E.members[i].compressive_failure=true;
				console.log('member '+i+' failed due to compression');
			}
		}
	}
}

module.exports=function (){
	Grid.calcPxPerCm(E);
	E.design_weight=calculateDesignWeight();

	E.loadedPin.external_force=[0,-1*E.design_weight*9.8*E.desired_ratio/1000/2];//we devide by 2 because we're calculating for half the truss
	calculateSupportReactions();
	methodOfJoints();
	calculateRuptureAndBucklingStress();
	// calculateSupportReactions();
	// calculateWeightDistributionOfCar();
	// methodOfJoints();
	// $('#bridge_cost').text(calculateCost());
};
