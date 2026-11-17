%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

Unistudium 2022: students groups logs on moodle.

Valentina Franzoni, Giulio Biondi, Alfredo Milani
University of Perugia, Perugia, Italy

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
KITLab - Knowledge and Information Technology
         Laboratory
https://www.dmi.unipg.it/kitlab/

KIT Lab is member of the CLAIRE Network
The Confederation of Laboratories for Artificial 
Intelligence Research in Europe (CLAIRE)
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

Contact: valentina.franzoni@unipg.it
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

This dataset contains the logs collected by Unistudium, the University of Perugia elearning platform based on moodle, a open source software for learning management systems (https://moodle.org).

The platform support blended learning, providing teaching material to courses in presence delivered at University of Perugia. 

The collected logs refers to interaction with the platform of students attending 4 courses in the time interval of one semester, from 1st September to 31st December.

Data are completely anomymized: 
user id have been randomly generated, and consistently substituted, courses labels have no reference to the original course name, all other identifying information in the original logs are not present.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
DATA descrition.

Logs contain four data fields in CSV format

Fields descriptions:

userid		: string , unique ser identifier user+progressive integer
moodleAction	: string , stan moodle name for user action
course		: char   , label of the course the user is enrolled in "A","B", "C", "D"
dateTime	: integer, time stamp of the log

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
