
$files=(Resolve-Path -Path componentsAssets/* -Relative)

ForEach ($file in $files)
{
	npm install  $file
}