@echo off

echo.
echo *** Reverse Schema Script ***
echo *** Generates a schemascript of user-defined schema from an existing database ***
echo.

if "%1" == "" goto usage

cscript //nologo //E:jscript   reverseSchemaScript.js > %1

echo Done. Output file is: %1

goto done

:usage
echo.
echo Missing arguments!
echo Usage: reverseSchemaScript.bat name_of_schemascript_file_to_be_created
echo.

:done

