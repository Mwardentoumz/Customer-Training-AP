
/* eslint no-empty-function: "off", no-unused-vars: "off" */
/* LIB_DEFINITION
{
	"name": "LIB_COMPONENTS",
	"libraryType": "LIB",
	"scriptType": "COMMON",
	"require": [
		"Sys/Sys_Helpers",
		"Sys/Sys_Helpers_Date",
		"Sys/Sys_Helpers_Array",
		"Sys/Sys_Helpers_String",
		"Sys/Sys_Helpers_Promise",
		"Sys/Sys_Helpers_LdapUtil"
	]
}
*/

import { loadPolyfills } from "@esker-sdk/component-ps-libraries";
//import { init as initVisibility } from "./FieldVisibility";
loadPolyfills();

/**
 * Components Initialisation
 */

//initVisibility();