// @ts-nocheck
import { nodeResolve } from '@rollup/plugin-node-resolve';
const extensions = ['.js', '.ts', '.mjs', '.js', '.json', '.node'];
import { globSync } from 'node:fs';
const CUSTOM_LIBRARIES = globSync(['./.tmp/Components/LIB_COMPONENTS.js']);

if(CUSTOM_LIBRARIES.length === 0) {
	throw new Error('LIB_COMPONENTS has not been found in .tmp/Components. It highly means that it has not been transpile correctly.')
}

function basename(path)
{
	return path.split(/\/|\\/).reverse()[1] + "/" + path.split(/\/|\\/).reverse()[0];
}

export const plugins = [
	nodeResolve({ extensions }),
];
export const ESKER_LIB_BUILDER = (originalFileName) => ({
	name: 'esker-library-builder',
	generateBundle(options, bundles)
	{
		// LIB_DEFINITION variables
		var headerRegex = /\/\*\s*LIB_DEFINITION((?:.|(?:\r)?\n)*?)\*\//;
		var globalHeaderRegex = /(\/\/\/\s*#GLOBALS\s.*)/;
		///#GLOBALS Lib Sys
		var keys = Object.keys(bundles);
		let bundle = bundles[keys[0]];

		// Move LIB_DEFINITION at the top.
		const match = bundle.code.match(headerRegex);
		if (match && match.length > 1)
		{
			try
			{
				// Check if LIB_DEFINITION is valid
				const json = JSON.parse(match[1]);

				bundle.code = bundle.code.replace(headerRegex, '');
				bundle.code = `/* LIB_DEFINITION\r${JSON.stringify(json, null, 4)}*/\n` + bundle.code;

			}
			catch (e)
			{
				throw new Error(`Invalid LIB_DEFINITION : ${e.message}`);
			}
		}
		// Move #GLOBALS at the top.
		const match2 = bundle.code.match(globalHeaderRegex);
		if (match2 && match2.length > 1)
		{
			try
			{
				bundle.code = bundle.code.replace(globalHeaderRegex, '');
				bundle.code = match2[1] + '\n' + bundle.code;

			}
			catch (e)
			{
				throw new Error(`Invalid LIB_DEFINITION : ${e.message}`);
			}
		}
	}

});
const LibConfigs = CUSTOM_LIBRARIES.map(inputFile =>
{
	const outputFile = `Out/${basename(inputFile)}`;
	return {
		input: inputFile,
		plugins: [...plugins, ESKER_LIB_BUILDER()],
		output: {
			banner: 'var Lib;',
			file: outputFile,
			interop: 'default',
			//name: 'Lib.Components',
			extend: true,
			strict: false,
			format: 'iife' // immediately-invoked function expression — suitable for <script> tags
		},
		context: 'this',
		treeshake: "recommended",
		shimMissingExports: true
	};

});
export default [...LibConfigs];