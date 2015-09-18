//*****************************************************
// Main Processing
//*****************************************************
var FCApp = WScript.CreateObject('FCFLCompat.FCApplication');
FCApp.Initialize();
var FCSession=FCApp.CreateSession();
FCSession.LoginFromFCApp();

var comment_field = "comment";

printHeader();
SetupCommentsField();
GetCustomColumnsOnExistingTables();
GetCustomRelationsOnExistingTables();
GetCustomTablesAndViews();
printFooter();
//*****************************************************
//  End of main processing
//*****************************************************


function SetupCommentsField(){
      var sql = "select * from adp_sch_info where type_id = 0";
		  var SqlDB = FCSession.CreateSQLExec();
		  SqlDB.ExecuteReturnRows(sql);
		  var records = SqlDB.Records;  
      var fldCount = records.Fields.Count
      for (count=1;count <= fldCount;count++) {
        if (records.Fields(count - 1).Name.toLowerCase() + '' == "comments")
          { comment_field = "comments"; }          
      }
      records.Close();
      records = null;      
}
		  
//*****************************************************
// Get the custom columns on existing tables
//
//  Look for columns marked as user_defined on clarify baseline tables,
//       OR where the field_name starts with x_
//*****************************************************
function GetCustomColumnsOnExistingTables(){
   var sql=  "select * from adp_sch_info where ";
   if(FCApp.db_type == "oracle"){
      sql+= " (((type_id < 430) OR (type_id >= 512 and type_id < 2000) OR (type_id >= 5000)) and (BITAND(flags, 4) > 0 or field_name like 'x_%'))";
   } else {
      sql+=" (((type_id < 430) OR  (type_id >= 512 and type_id < 2000) OR ( type_id >= 5000)) and ((flags & 4) > 0)) OR ";
      sql+=" (((type_id < 430) OR  (type_id >= 512 and type_id < 2000) OR ( type_id >= 5000)) and field_name like 'x[_]%' )";
   }
   sql+=" order by type_id";
   var SqlDB = FCSession.CreateSQLExec();
   SqlDB.ExecuteReturnRows(sql);
   var records = SqlDB.Records;
   var numAddColumns = 0;

   while (records.EOF != true) {
      var columnName = records('field_name');
      var dataType = records('db_type');
      var length = records('array_size');
      var description = records(comment_field);
      var flags = records('flags');
      var tableName = GetTableName(records('type_id'));
      var tableId = records('type_id');
      var gen_field_id = records('gen_field_id');

      if(!IsView(tableId)){
         numAddColumns++;
         rw('<addColumn name="' + columnName + '" dataType="' + TranslateDBType(dataType)  + '" table="' + tableName + '" >');
         if(length > 0){
            rw('    <length>' + length  + '</length>');
         }
         if((flags & 256) > 0){
           rw('    <isSearchable>' + true + '</isSearchable>');
         }
         if((flags & 128) > 0){
            rw('    <isNullable>' + true + '</isNullable>');
         }
         printDescription(description);
         printGenericFieldId(gen_field_id);
         rw('</addColumn>');
      }
      records.MoveNext();
   }
}

//*****************************************************
// Get the custom relations on existing tables
//
//  Look for relations marked as user_defined on clarify baseline tables,
//*****************************************************
function GetCustomRelationsOnExistingTables(){
   var sql=  "select * from adp_sch_rel_info where ";
   sql+=" (((type_id < 430) OR  (type_id >= 512 and type_id < 2000) OR ( type_id >= 5000)) "
   if(FCApp.db_type == "oracle"){
      sql+=" and ((BITAND(flags, 131072) > 0))";
   } else {
      sql+=" and ((flags & 131072) > 0))";
   }

   sql+=" and rel_type in (1,3,5,11)";
   sql+=" order by type_id";
   var SqlDB = FCSession.CreateSQLExec();
   SqlDB.ExecuteReturnRows(sql);
   var records = SqlDB.Records;

   while (records.EOF != true) {
      var relationName = records('rel_name');
      var type = records('rel_type');
      var inverseRelationName = records('inv_rel_name');
      var inverseTable = records('target_name');
      var description = records(comment_field);
      var tableName = GetTableName(records('type_id'));
      var tableId = records('type_id');
      type = TranslateRelType(type);

      var sql2=  "select * from adp_sch_rel_info where target_name = '";
      sql2+= tableName;
      sql2+= "' and rel_name='";
      sql2+= inverseRelationName;
      sql2+= "'";
      SqlDB.ExecuteReturnRows(sql2);
      var records2 = SqlDB.Records;

      var inverseDescription = records2(comment_field);

      var addRelation = '<addRelation name="';
          addRelation+= relationName;
          addRelation+= '" type="';
          addRelation+=type;
          addRelation+='" table="';
          addRelation+=tableName;
          addRelation+='"';
          addRelation+=' inverseRelationName="';
          addRelation+=inverseRelationName;
          addRelation+='"';
          addRelation+=' inverseTable="';
          addRelation+=inverseTable;
          addRelation+='" >';

      rw(addRelation);

      printDescription(description);
      printInverseDescription(inverseDescription);
      rw('</addRelation>');

      records.MoveNext();
   }
}

//*****************************************************
// Get the custom tables and views
//*****************************************************
function GetCustomTablesAndViews(){
   var SqlDBTables = FCSession.CreateSQLExec();
   var comments = comment_field;
   var table_sql= "select type_name, type_flags, " + comments +
                  ", obj_group, type_id, type_flags from adp_tbl_name_map where " +
                  "(type_id >= 430 and type_id < 512) Or (type_id >= 2000 and type_id < 5000) order by type_id";

   SqlDBTables.ExecuteReturnRows(table_sql);
   var rsTables = SqlDBTables.Records;

   while (rsTables.EOF != true) {
      if((rsTables('type_flags') & 512) > 0) {
         printAddView(rsTables('type_name'), rsTables("type_id") , rsTables(comments) , rsTables("obj_group"));
      } else {
         printAddTable(rsTables('type_name'), rsTables("type_id") , rsTables(comments) , rsTables("obj_group"));
      }
      rsTables.MoveNext();
   }
}

//*****************************************************
// Response.Write equivalent
//*****************************************************
function rw(foo){
   WScript.Echo(foo);
}

//*****************************************************
//
//*****************************************************
function printDescription(description){
   if(new String(description).length > 0){
      //todo - add CDATA:
      rw('    <description>' + description  + '</description>');
   }
}

//*****************************************************
//
//*****************************************************
function printGroupName(groupName){
   if(new String(groupName).length > 0){
      rw('    <groupName>' + groupName  + '</groupName>');
   }
}

//*****************************************************
//
//*****************************************************
function printInverseDescription(description){
   if(new String(description).length > 0){
      //todo - add CDATA:
      rw('    <inverseDescription>' + description  + '</inverseDescription>');
   }
}

//*****************************************************
//
//*****************************************************
function printGenericFieldId(gen_field_id){
   if(gen_field_id - 0 > 0){
      rw('    <clarifyGenericFieldID>' + gen_field_id  + '</clarifyGenericFieldID>');
   }
}

//*****************************************************
//
//*****************************************************
function printAddView(name, id, description, groupName){
   rw('');
   rw('');
   rw('<addView name="' + name + '" id="' + id + '">');
   printDescription(description);
   printGroupName(groupName);
   rw('</addView>');
   rw('');
   printAllViewColumnsForCustomView(name,id);
   rw('');
   printAllJoinsForCustomView(name,id);
   rw('');
}

//*****************************************************
//
//*****************************************************
function printAddTable(name, id, description, groupName){
   rw('');
   rw('');
   rw('<addTable name="' + name + '" id="' + id + '">');
   printDescription(description);
   printGroupName(groupName);
   rw('</addTable>');
   rw('');
   printAllColumnsForCustomTable(name,id)
   rw('');
   printAllRelationsForCustomTable(name,id);
   rw('');
   printAllIndexesForCustomTable(name,id);
   rw('');
}


//*****************************************************
//
//*****************************************************
function printAllColumnsForCustomTable(tableName,tableId){
   var sql=  "select * from adp_sch_info where type_id = ";
   sql+= tableId;
   sql+=" order by spec_field_id";
   var SqlDB = FCSession.CreateSQLExec();
   SqlDB.ExecuteReturnRows(sql);
   var records = SqlDB.Records;

   while (records.EOF != true) {
      var columnName = records('field_name');
      var dataType = records('db_type');
      var length = records('array_size');
      var description = records(comment_field);
      var flags = records('flags');
      var gen_field_id = records('gen_field_id');

      rw('<addColumn name="' + columnName + '" dataType="' + TranslateDBType(dataType)  + '" table="' + tableName + '" >');
      if(length > 0){
        rw('    <length>' + length  + '</length>');
      }
      if((flags & 256) > 0){
        rw('    <isSearchable>' + true + '</isSearchable>');
      }
      if((flags & 128) > 0){
        rw('    <isNullable>' + true + '</isNullable>');
      }
      printDescription(description);
      printGenericFieldId(gen_field_id);
      rw('</addColumn>');

      records.MoveNext();
   }
}

//*****************************************************
//
//*****************************************************
function GetFieldName(TableNum, SpecFieldID) {
   TheSQL = "select * from adp_sch_info where type_id = ";
   TheSQL+= TableNum;
   TheSQL+= " and spec_field_id = ";
   TheSQL+= SpecFieldID;
   TheSQL+= " and flags != 48 "; //ignore binary array fields
   var SqlDB = FCSession.CreateSQLExec();
   SqlDB.ExecuteReturnRows(TheSQL);
   var records = SqlDB.Records;
   FieldName = records("field_name") + '';
   return FieldName;
}

//*****************************************************
//
//*****************************************************
function GetTableNum(TableName) {
   TableNum = -1;
   var TheSQL = "select type_id from adp_tbl_name_map where type_name = '";
   TheSQL+= TableName;
   TheSQL+= "'";
   var SqlDB = FCSession.CreateSQLExec();
   SqlDB.ExecuteReturnRows(TheSQL);
   var records = SqlDB.Records;
   TableNum = records(0) - 0;
   return TableNum;
}

//*****************************************************
//
//*****************************************************
function GetTableName(TableNum)
{
      //Get the Table Name
    TheSQL = "select type_name from adp_tbl_name_map where type_id = ";
      TheSQL+= TableNum;
    var SqlDB = FCSession.CreateSQLExec();
    SqlDB.ExecuteReturnRows(TheSQL);
    var records = SqlDB.Records;
      TableName = records(0) + '';
      return TableName;
}

//*****************************************************
//
//*****************************************************
function printAllViewColumnsForCustomView(viewName,viewId){
   var sql=  "select * from adp_view_field_info where view_type_id = " + viewId;
   sql+=" and flags = 0 order by view_spec_field_id";
   var SqlDB = FCSession.CreateSQLExec();
   SqlDB.ExecuteReturnRows(sql);
   var records = SqlDB.Records;

   if (records.EOF){
      var sql=  "select * from adp_view_field_info where view_type_id = " + viewId;
      sql+=" and flags = 1 order by view_spec_field_id";
      var SqlDB = FCSession.CreateSQLExec();
      SqlDB.ExecuteReturnRows(sql);
      var records = SqlDB.Records;
   }

   //Get all of the View field names
   TheSQL = "select * from adp_sch_info where type_id = ";
   TheSQL+= viewId;
   TheSQL+=" order by spec_field_id";
   var SqlDB2 = FCSession.CreateSQLExec();
   SqlDB2.ExecuteReturnRows(TheSQL);
   var records2 = SqlDB2.Records;

   while (records.EOF != true) {
      var description = records(comment_field);
      var alias = records('alias') + '';
      var fromObjType = records('from_obj_type') - 0;
      var fromFieldId = records('from_field_id') - 0;
      //We need to subtract a higher order bit to get the correct field ID
      if (fromFieldId >= 16384) {fromFieldId = fromFieldId - 16384;}

      var name = records2("field_name");
      var gen_field_id = records2('gen_field_id');

      var column = GetFieldName(fromObjType, fromFieldId);
      var table = GetTableName(fromObjType);

      rw('<addViewColumn name="' + name + '" column="' + column  + '" table="' + table + '" view="' + viewName + '" >');
      printDescription(description);
      if (new String(alias).length > 0){
         rw('    <alias>' + alias + '</alias>');
      }
      printGenericFieldId(gen_field_id);
      rw('</addViewColumn>');

      records2.MoveNext();
      records.MoveNext();
   }
}

//*****************************************************
//
//*****************************************************
function printAllJoinsForCustomView(viewName,viewId){
   var sql=  "select * from adp_view_join_info where view_type_id = ";
   sql+= viewId;
   sql+=" and flags = 1";

   var SqlDBJoin = FCSession.CreateSQLExec();
   SqlDBJoin.ExecuteReturnRows(sql);
   var rsJoins = SqlDBJoin.Records;

   //Define a new array
   //Its structure will look like:
   //Column 0: From Table ID
   //Column 1: From Table Name
   //Column 2: From Spec Rel ID
   //Column 3: From Relation Name
   //Column 4: To Table Name
   //Column 5: To Relation Name
   //Column 6: From Table Alias
   //Column 7: To Table Alias
   //Column 8: Join Flag
   //Column 9: Join Comments

   JOIN_FROM_TBL_ID = "obj_type_id";
   JOIN_PRIM_ALIAS = "palias";
   JOIN_SEC_ALIAS = "falias";

   JoinArray = new Array();

   row = 0;
   while (!rsJoins.EOF) {
      ObjectTypeID = rsJoins(JOIN_FROM_TBL_ID) + '';
      ToAlias = rsJoins(JOIN_PRIM_ALIAS) + "";
      FromAlias = rsJoins(JOIN_SEC_ALIAS) + "";
      JoinFlag = rsJoins("join_flag") + "";
      ObjectSpecRelID = 0;
      var comments = rsJoins(comment_field) + "";

      ObjectSpecRelID = rsJoins("obj_spec_rel_id") - 0;
      if (ObjectSpecRelID >= 16384) {
         ObjectSpecRelID = ObjectSpecRelID - 16384;
      }

      JoinArray[row] = new Array();
      JoinArray[row][0] = ObjectTypeID + "";
      JoinArray[row][6] = FromAlias + "";
      JoinArray[row][7] = ToAlias + "";
      JoinArray[row][8] = JoinFlag + "";
      JoinArray[row][9] = comments;

      //Get the Table Name
      TableName = GetTableName(ObjectTypeID);
      JoinArray[row][1] = TableName + "";

      //Get the Relation Info
      var TheSQL = "select * from adp_sch_rel_info where type_id = ";
      TheSQL+= ObjectTypeID;
      TheSQL+= " and spec_rel_id = ";
      TheSQL+= ObjectSpecRelID;
      var SqlDB3 = FCSession.CreateSQLExec();
      SqlDB3.ExecuteReturnRows(TheSQL);
      var rsRelName = SqlDB3.Records;

      JoinArray[row][3] = rsRelName("rel_name") + "";
      JoinArray[row][4] = rsRelName("target_name") + "";
      JoinArray[row][5] = rsRelName("inv_rel_name") + "";

      row = row + 1;
      rsJoins.MoveNext();
   } //end of while

   nFields = JoinArray.length;
   for(row = 0; row < nFields; row++) {
      FromTableNum = JoinArray[row][0];
      FromTable = JoinArray[row][1];
      FromRel = JoinArray[row][3];
      ToTable = JoinArray[row][4];
      ToRel = JoinArray[row][5];
      FromAlias = JoinArray[row][6];
      ToAlias = JoinArray[row][7];
      JoinFlag = JoinArray[row][8];
      description = JoinArray[row][9];

      FromJoin = '';
      ToJoin = '';
      LeftOuter = '';
      RightOuter = '';

      var kind="Inner";
      if (JoinFlag == "1") kind = "Left";
      if (JoinFlag == "2") kind = "Right";

      rw('<addJoin kind="' + kind + '" relation="' + FromRel  + '" table="' + FromTable + '" view="' + viewName + '" >');
      printDescription(description);
      if (new String(FromAlias).length > 0){
         rw('    <alias>' + FromAlias + '</alias>');
      }
      if (new String(ToAlias).length > 0){
         rw('    <toAlias>' + ToAlias + '</toAlias>');
      }
      rw('</addJoin>');
   }
}


//*****************************************************
//
//*****************************************************
function printAllIndexesForCustomTable(tableName,tableId){
   var sql=  "select * from adp_sch_index where type_id = ";
   sql+= tableId;
  var SqlDB = FCSession.CreateSQLExec();
  SqlDB.ExecuteReturnRows(sql);
  var records = SqlDB.Records;

  while (records.EOF != true)
  {
    var indexName = records('index_name');
    var columns = records('field_names');
    var flags = records('flags');
    var description = records(comment_field);

    rw('<addIndex name="' + indexName + '" columns="' + columns  + '" table="' + tableName + '" >');
    printDescription(description);
    if((flags & 1) > 0){
      rw('    <isUnique>' + true + '</isUnique>');
    }
    rw('</addIndex>');

   records.MoveNext();
  }
}

//*****************************************************
//
//*****************************************************
function printAllRelationsForCustomTable(tableName,tableId){
   var sql=  "select * from adp_sch_rel_info where rel_type in (1,3,5,11) and type_id = " + tableId;
   var SqlDB = FCSession.CreateSQLExec();
   SqlDB.ExecuteReturnRows(sql);
   var records = SqlDB.Records;

   while (records.EOF != true) {
      var relationName = records('rel_name');
      var type = records('rel_type');
      var inverseRelationName = records('inv_rel_name');
      var inverseTable = records('target_name');
      var description = records(comment_field);

      type = TranslateRelType(type);

      var sql2=  "select * from adp_sch_rel_info where target_name = '";
      sql2+= tableName;
      sql2+= "' and rel_name='";
      sql2+= inverseRelationName;
      sql2+= "'";
      SqlDB.ExecuteReturnRows(sql2);
      var records2 = SqlDB.Records;

      var inverseDescription = records2(comment_field);

      var addRelation = '<addRelation name="';
          addRelation+= relationName;
          addRelation+= '" type="';
          addRelation+=type;
          addRelation+='" table="';
          addRelation+=tableName;
          addRelation+='"';
          addRelation+=' inverseRelationName="';
          addRelation+=inverseRelationName;
          addRelation+='"';
          addRelation+=' inverseTable="';
          addRelation+=inverseTable;
          addRelation+='" >';

      rw(addRelation);

      printDescription(description);
      printInverseDescription(inverseDescription);
      rw('</addRelation>');

      records.MoveNext();
  }
}

//*****************************************************
//
//*****************************************************
function TranslateRelType(RelType) {
   switch (RelType + 0) {
      case 1:
         RelString = "OneToMany";
         break;
      case 2:
         RelString = "MTO";
         break;
      case 3:
         RelString = "OneToOne";
         break;
      case 4:
         RelString = "OTOF";
         break;
      case 5:
         RelString = "ManyToMany";
         break;
      case 10:
         RelString = "MTO";
         break;
      case 11:
         RelString = "OneToOne";
         break;
      default:
         RelString = "*** error ***";
         break;
   }
   return RelString;
}

//*****************************************************
//
//*****************************************************
function TranslateDBType(DBType) {
   switch (DBType + 0) {
      case 0:
         DBString = "Integer";
         break;
      case 1:
         DBString = "SmallInteger";
         break;
      case 2:
         DBString = "TinyInteger";
         break;
      case 3:
         DBString = "Real";
         break;
      case 4:
         DBString = "Double";
         break;
      case 6:
         DBString = "Character";
         break;
      case 7:
         DBString = "String";
         break;
      case 8:
         DBString = "LongString";
         break;
      case 9:
         DBString = "DateTime";
         break;
      case 11:
         DBString = "Decimal";
         break;
      default:
         DBString = "** error ***" + DBType;
         break;
   }
   return DBString;
}

//*****************************************************
//
//*****************************************************
function printHeader(){
   rw('<schemaScript xmlns="http://www.dovetailsoftware.com/2006/10/SchemaScript.xsd">');
   rw('');
}


//*****************************************************
//
//*****************************************************
function printFooter(){
   rw('');
   rw('</schemaScript>');
}

//*****************************************************
//
//*****************************************************
function IsView(TypeID) {
   //Get the Table/View flags
   TheSQL = "select type_flags from adp_tbl_name_map where type_id = " + TypeID;
   var SqlDB = FCSession.CreateSQLExec();
   SqlDB.ExecuteReturnRows(TheSQL);
   var rs = SqlDB.Records;
   Flags = 0;
   try {
      Flags = rs(0) - 0;
   } catch (e) { }

   //If the flag 512 bit is on, then this is a view
   Flags = Flags & 512;

   if(Flags > 0) {
      return true;
   } else {
      return false;
   }
}
